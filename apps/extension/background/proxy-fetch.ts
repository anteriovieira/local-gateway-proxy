import { getProxyState, findMatchingEndpoint } from './proxy-engine'
import { resolveUrl } from '@proxy-app/shared'
import { addProxyLog } from './request-logger'
import { MAX_RESPONSE_BODY_SIZE } from './constants'

export interface ProxyFetchRequest {
    url: string
    method: string
    headers: Record<string, string>
    body: ArrayBuffer | null
}

export interface ProxyFetchResponse {
    proxied: boolean
    status?: number
    statusText?: string
    headers?: Record<string, string>
    body?: ArrayBuffer
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
        if (payload.body && ['POST', 'PUT', 'PATCH'].includes(payload.method.toUpperCase())) {
            fetchInit.body = payload.body
        }

        const response = await fetch(urlWithQuery, fetchInit)
        const body = await response.arrayBuffer()
        const duration = Date.now() - startTime

        const responseHeaders: Record<string, string> = {}
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value
        })

        const responseBodyStr = new TextDecoder().decode(body)
        const responseBodyForLog =
            responseBodyStr.length <= MAX_RESPONSE_BODY_SIZE
                ? responseBodyStr
                : responseBodyStr.substring(0, MAX_RESPONSE_BODY_SIZE) + `\n\n... (truncated, total ${responseBodyStr.length} bytes)`

        const requestBodyStr = payload.body
            ? (() => {
                  try {
                      const s = new TextDecoder().decode(payload.body)
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
            body: new TextEncoder().encode(JSON.stringify({ error })).buffer,
            error,
        }
    }
}
