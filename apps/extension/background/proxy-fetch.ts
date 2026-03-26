import { getProxyState, findMatchingEndpoint } from './proxy-engine'
import { resolveUrl, MockDatabase, handleMockDbEndpoint, applyResponseTemplate } from '@proxy-app/shared'
import type { MockDbSnapshot } from '@proxy-app/shared'
import { addProxyLog } from './request-logger'
import { MAX_RESPONSE_BODY_SIZE } from './constants'

// Singleton mock database instance for the active workspace
let mockDb: MockDatabase | null = null

const MOCK_DB_STORAGE_KEY = 'mockDbSnapshot'

export function getMockDb(): MockDatabase | null {
    return mockDb
}

export function initMockDb(snapshot: MockDbSnapshot): MockDatabase {
    mockDb = new MockDatabase()
    mockDb.load(snapshot)
    // Persist snapshot so it survives service worker restarts
    chrome.storage.session.set({ [MOCK_DB_STORAGE_KEY]: snapshot }).catch(() => {})
    return mockDb
}

export function destroyMockDb(): void {
    mockDb = null
    chrome.storage.session.remove(MOCK_DB_STORAGE_KEY).catch(() => {})
}

/**
 * Restore mock database from chrome.storage.session on service worker startup.
 */
export async function restoreMockDb(): Promise<void> {
    try {
        const result = await chrome.storage.session.get(MOCK_DB_STORAGE_KEY)
        const snapshot = result[MOCK_DB_STORAGE_KEY] as MockDbSnapshot | undefined
        if (snapshot) {
            mockDb = new MockDatabase()
            mockDb.load(snapshot)
        }
    } catch {
        // storage.session not available or empty
    }
}

export interface ProxyFetchRequest {
    url: string
    method: string
    headers: Record<string, string>
    body: ArrayBuffer | number[] | null
}

export interface ProxyFetchResponse {
    proxied: boolean
    status?: number
    statusText?: string
    headers?: Record<string, string>
    /** Body as number[] for JSON-safe serialization through chrome.runtime.sendMessage */
    body?: number[]
    error?: string
}

/** Headers to forward from the original request to the backend */
const FORWARD_HEADERS = [
    'accept',
    'accept-language',
    'content-type',
    'authorization',
    'x-api-key',
    'x-idempotency-key',
    'cache-control',
    'pragma',
]

/**
 * Proxy a fetch request through the extension background (bypasses CORS).
 * Returns { proxied: false } if the request should not be proxied.
 */
export async function handleProxyFetch(payload: ProxyFetchRequest): Promise<ProxyFetchResponse> {
    const state = getProxyState()
    if (!state?.isActive) {
        return { proxied: false }
    }

    let pathname: string
    try {
        pathname = new URL(payload.url).pathname
    } catch {
        return { proxied: false }
    }

    const match = findMatchingEndpoint(pathname, payload.method, state.endpoints)
    if (!match) {
        return { proxied: false }
    }

    // Handle mock-db endpoints — CRUD against in-memory collection
    if (match.endpoint.isMock && match.endpoint.mockDbCollection && mockDb) {
        const startTime = Date.now()
        const delay = match.endpoint.mockDelay ?? 0
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay))
        }

        let requestBody: Record<string, unknown> | null = null
        if (payload.body != null) {
            try {
                const buf = payload.body instanceof ArrayBuffer
                    ? payload.body
                    : new Uint8Array(payload.body as number[]).buffer
                requestBody = JSON.parse(new TextDecoder().decode(buf))
            } catch {
                requestBody = null
            }
        }

        const result = handleMockDbEndpoint(mockDb, match.endpoint.mockDbCollection, payload.method, match.params, requestBody)

        let finalBody = result.body
        try {
            finalBody = applyResponseTemplate(result.body, match.endpoint.mockResponseTemplate)
        } catch { /* template produced invalid JSON — fall back to raw body */ }

        // Persist updated snapshot after write operations and broadcast to UI
        const upperMethod = payload.method.toUpperCase()
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod)) {
            const snapshot = mockDb.toSnapshot()
            chrome.storage.session.set({ [MOCK_DB_STORAGE_KEY]: snapshot }).catch(() => {})
            chrome.runtime.sendMessage({
                type: 'mock-db-updated',
                payload: { snapshot },
            }).catch(() => {})
        }

        const duration = Date.now() - startTime
        const bodyStr = JSON.stringify(finalBody)
        const body = Array.from(new TextEncoder().encode(bodyStr))

        addProxyLog({
            requestUrl: payload.url,
            targetUrl: '(mock-db)',
            method: payload.method,
            path: pathname,
            status: result.status >= 200 && result.status < 400 ? 'completed' : 'error',
            statusCode: result.status,
            duration,
            responseBody: bodyStr,
            requestBody: requestBody ? JSON.stringify(requestBody) : undefined,
            requestHeaders: payload.headers,
            responseHeaders: result.headers,
            isMock: true,
        })

        return {
            proxied: true,
            status: result.status,
            statusText: result.status === 200 ? 'OK' : result.status === 201 ? 'Created' : 'Mock DB',
            headers: result.headers,
            body,
        }
    }

    // Handle mock endpoints with fixed response
    if (match.endpoint.isMock && match.endpoint.mockResponse != null) {
        const delay = match.endpoint.mockDelay ?? 0
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay))
        }

        const statusCode = match.endpoint.mockStatusCode ?? 200
        const responseHeaders: Record<string, string> = {
            'content-type': 'application/json',
            'access-control-allow-origin': '*',
            'x-mock-response': 'true',
            ...(match.endpoint.mockHeaders ?? {}),
        }
        const body = Array.from(new TextEncoder().encode(match.endpoint.mockResponse))

        addProxyLog({
            requestUrl: payload.url,
            targetUrl: '(mock)',
            method: payload.method,
            path: pathname,
            status: statusCode >= 200 && statusCode < 400 ? 'completed' : 'error',
            statusCode,
            duration: delay,
            responseBody: match.endpoint.mockResponse,
            requestHeaders: payload.headers,
            responseHeaders,
            isMock: true,
        })

        return {
            proxied: true,
            status: statusCode,
            statusText: statusCode === 200 ? 'OK' : 'Mock Response',
            headers: responseHeaders,
            body,
        }
    }

    const startTime = Date.now()
    try {
        const targetUrl = resolveUrl(match.endpoint.uriTemplate, state.variables, match.params)
        const requestUrl = new URL(payload.url)
        const urlWithQuery = targetUrl + (requestUrl.search || '')

        const headers: Record<string, string> = {}
        for (const name of FORWARD_HEADERS) {
            const value = payload.headers[name] ?? payload.headers[name.toLowerCase()]
            if (value) headers[name] = value
        }

        const fetchInit: RequestInit = {
            method: payload.method,
            headers,
            credentials: 'omit',
        }
        if (payload.body != null && ['POST', 'PUT', 'PATCH'].includes(payload.method.toUpperCase())) {
            // Reconstruct ArrayBuffer if it was serialized as number[] through chrome.runtime.sendMessage
            if (payload.body instanceof ArrayBuffer) {
                fetchInit.body = payload.body
            } else if (Array.isArray(payload.body)) {
                fetchInit.body = new Uint8Array(payload.body).buffer
            }
        }

        const response = await fetch(urlWithQuery, fetchInit)
        const bodyBuf = await response.arrayBuffer()
        const body = Array.from(new Uint8Array(bodyBuf))
        const duration = Date.now() - startTime

        const responseHeaders: Record<string, string> = {}
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value
        })

        const responseBodyStr = new TextDecoder().decode(bodyBuf)
        const responseBodyForLog =
            responseBodyStr.length <= MAX_RESPONSE_BODY_SIZE
                ? responseBodyStr
                : responseBodyStr.substring(0, MAX_RESPONSE_BODY_SIZE) + `\n\n... (truncated, total ${responseBodyStr.length} bytes)`

        const requestBodyStr = payload.body != null
            ? (() => {
                  try {
                      const buf = payload.body instanceof ArrayBuffer
                          ? payload.body
                          : new Uint8Array(payload.body as number[]).buffer
                      const s = new TextDecoder().decode(buf)
                      return s.length <= MAX_RESPONSE_BODY_SIZE ? s : s.substring(0, MAX_RESPONSE_BODY_SIZE) + `\n\n... (truncated)`
                  } catch {
                      return undefined
                  }
              })()
            : undefined

        addProxyLog({
            requestUrl: payload.url,
            targetUrl: urlWithQuery,
            method: payload.method,
            path: pathname,
            status: response.ok ? 'completed' : 'error',
            statusCode: response.status,
            duration,
            responseBody: responseBodyForLog,
            requestBody: requestBodyStr,
            requestHeaders: payload.headers,
            responseHeaders: responseHeaders,
        })

        return {
            proxied: true,
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body,
        }
    } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err)
        const duration = Date.now() - startTime
        addProxyLog({
            requestUrl: payload.url,
            targetUrl: '',
            method: payload.method,
            path: pathname,
            status: 'error',
            statusCode: 500,
            duration,
            error,
        })
        return {
            proxied: true,
            status: 500,
            statusText: 'Proxy Error',
            headers: { 'content-type': 'application/json' },
            body: Array.from(new TextEncoder().encode(JSON.stringify({ error }))),
            error,
        }
    }
}
