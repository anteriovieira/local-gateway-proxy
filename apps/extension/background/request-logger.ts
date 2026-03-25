import type { ApiLogEntry } from '@proxy-app/shared'
import { resolveUrl } from '@proxy-app/shared'
import { getProxyState, findMatchingEndpoint } from './proxy-engine'

let logs: ApiLogEntry[] = []
let logIdCounter = 0
const pendingRequests = new Map<string, { startTime: number; logId: string }>()

function generateLogId(): string {
    return `log-${Date.now()}-${++logIdCounter}`
}

/** Decode requestBody from webRequest details to a displayable string */
function decodeRequestBody(details: chrome.webRequest.WebRequestBodyDetails): string | undefined {
    const rb = details.requestBody
    if (!rb) return undefined
    if (rb.raw && rb.raw.length > 0) {
        try {
            const parts: string[] = []
            for (const chunk of rb.raw) {
                const bytes = chunk.bytes
                if (bytes) {
                    parts.push(new TextDecoder('utf-8').decode(bytes))
                }
            }
            return parts.length > 0 ? parts.join('') : undefined
        } catch {
            return undefined
        }
    }
    if (rb.formData) {
        try {
            return JSON.stringify(rb.formData, null, 2)
        } catch {
            return undefined
        }
    }
    return undefined
}

/**
 * Initialize webRequest listeners for logging intercepted requests.
 * Only captures requests whose type is in the workspace's captureResourceTypes (default: xmlhttprequest).
 */
export function initRequestLogger(): void {
    // Log when a request starts
    chrome.webRequest.onBeforeRequest.addListener(
        (details) => {
            const state = getProxyState()
            if (!state?.isActive) return
            const types = state.captureResourceTypes ?? ['xmlhttprequest']
            const requestType = (details as { type?: string }).type ?? 'other'
            if (!types.includes(requestType)) return

            const filter = state.urlMustContain?.trim()
            if (filter && !details.url.toLowerCase().includes(filter.toLowerCase())) return

            const pathname = new URL(details.url).pathname
            const method = details.method || 'GET'

            // Skip internal/debug URLs to avoid circular capture (e.g. debug ingest, extension's own requests)
            if (details.url.includes('/ingest/') && details.url.includes('127.0.0.1')) return

            const match = findMatchingEndpoint(pathname, method, state.endpoints)
            let targetUrl = details.url
            if (match) {
                try {
                    const resolved = resolveUrl(match.endpoint.uriTemplate, state.variables, match.params)
                    const requestUrl = new URL(details.url)
                    targetUrl = resolved + (requestUrl.search || '')
                } catch {
                    // Fallback to request URL if resolve fails (e.g. missing variables)
                }
            }

            const requestBody = decodeRequestBody(details as chrome.webRequest.WebRequestBodyDetails)
            const initiator = (details as { initiator?: string }).initiator
            const now = Date.now()

            // Deduplicate: if there's a recent pending log (same path+method, within 400ms),
            // associate this requestId with it instead of creating a new log.
            // This handles redirects where the original and redirected requests have different requestIds and paths.
            // E.g. original /api/search/topics -> redirect to /search/topics: associate the /search/topics
            // request with the existing /api/search/topics log instead of creating a duplicate.
            const recentPending = logs.find((l) => {
                if (l.status !== 'pending' || l.method.toUpperCase() !== method.toUpperCase()) return false
                if (now - new Date(l.timestamp).getTime() >= 400) return false
                // Same path as original request
                if (l.path === pathname) return true
                // Incoming path matches target path (this is the redirected request)
                if (l.targetUrl) {
                    try {
                        const targetPath = new URL(l.targetUrl).pathname
                        if (targetPath === pathname) return true
                    } catch {
                        /* ignore invalid URL */
                    }
                }
                return false
            })
            if (recentPending) {
                pendingRequests.set(details.requestId, {
                    startTime: now,
                    logId: recentPending.id
                })
                return
            }

            const logId = generateLogId()
            const entry: ApiLogEntry = {
                id: logId,
                timestamp: new Date().toISOString(),
                method,
                path: pathname,
                status: 'pending',
                requestUrl: details.url,
                targetUrl,
                ...(typeof initiator === 'string' && initiator && { initiatorUrl: initiator }),
                ...(requestBody && { requestBody })
            }

            pendingRequests.set(details.requestId, {
                startTime: now,
                logId
            })

            logs.push(entry)
            broadcastLog(entry, false)
        },
        { urls: ['<all_urls>'] },
        ['requestBody']
    )

    // Log when a request completes
    chrome.webRequest.onCompleted.addListener(
        (details) => {
            const pending = pendingRequests.get(details.requestId)
            if (!pending) return

            const duration = Date.now() - pending.startTime
            const logIndex = logs.findIndex(l => l.id === pending.logId)
            if (logIndex >= 0) {
                logs[logIndex] = {
                    ...logs[logIndex],
                    status: 'completed',
                    statusCode: details.statusCode,
                    duration
                }
                broadcastLog(logs[logIndex], true)
            }

            pendingRequests.delete(details.requestId)
        },
        { urls: ['<all_urls>'] }
    )

    // Log when a request errors
    chrome.webRequest.onErrorOccurred.addListener(
        (details) => {
            const pending = pendingRequests.get(details.requestId)
            if (!pending) return

            const logIndex = logs.findIndex(l => l.id === pending.logId)
            if (logIndex < 0) {
                pendingRequests.delete(details.requestId)
                return
            }
            // Don't overwrite with error if the log is already completed (e.g. redirect succeeded,
            // original request was cancelled but the redirected request completed)
            if (logs[logIndex].status === 'completed') {
                pendingRequests.delete(details.requestId)
                return
            }

            const duration = Date.now() - pending.startTime
            logs[logIndex] = {
                ...logs[logIndex],
                status: 'error',
                error: details.error,
                duration
            }
            broadcastLog(logs[logIndex], true)
            pendingRequests.delete(details.requestId)
        },
        { urls: ['<all_urls>'] }
    )
}

/**
 * Send a log entry to the side panel via messaging.
 */
function broadcastLog(log: ApiLogEntry, isUpdate: boolean): void {
    const state = getProxyState()
    const workspaceId = state?.workspaceId ?? ''
    try {
        chrome.runtime.sendMessage({
            type: 'api-log',
            payload: { workspaceId, apiLog: log, isUpdate }
        }).catch(() => {})
    } catch {
        // Extension context invalidated or side panel not open
    }
}

/**
 * Get all current logs.
 */
export function getLogs(): ApiLogEntry[] {
    return logs
}

/**
 * Update a log entry with response body. Matches by pathname + method, picks the most recent
 * completed/error log without responseBody (fallback when addProxyLog didn't capture it).
 */
export function updateLogWithResponseBody(pathname: string, method: string, body: string): void {
    const state = getProxyState()
    if (!state?.isActive) return

    // Find most recent log with matching path and method, without responseBody
    let found = false
    for (let i = logs.length - 1; i >= 0; i--) {
        const log = logs[i]
        let pathMatches = log.path === pathname
        if (!pathMatches && log.targetUrl) {
            try {
                pathMatches = new URL(log.targetUrl).pathname === pathname
            } catch {
                /* ignore invalid URL */
            }
        }
        if (
            (log.status === 'completed' || log.status === 'error') &&
            !log.responseBody &&
            log.method.toUpperCase() === method.toUpperCase() &&
            pathMatches
        ) {
            logs[i] = { ...log, responseBody: body }
            broadcastLog(logs[i], true)
            found = true
            break
        }
    }
}

/**
 * Clear all logs.
 */
export function clearLogs(): void {
    logs = []
    pendingRequests.clear()
}

/**
 * Add a log entry for a request proxied through the content script (no webRequest event).
 * Called from proxy-fetch when a request is successfully proxied.
 */
function shouldCaptureByUrlFilter(requestUrl: string): boolean {
    const state = getProxyState()
    const filter = state?.urlMustContain?.trim()
    if (!filter) return true
    return requestUrl.toLowerCase().includes(filter.toLowerCase())
}

export function addProxyLog(entry: {
    requestUrl: string
    targetUrl: string
    method: string
    path: string
    status: 'completed' | 'error'
    statusCode?: number
    duration?: number
    error?: string
    responseBody?: string
    requestBody?: string
    requestHeaders?: Record<string, string>
    responseHeaders?: Record<string, string>
}): void {
    const state = getProxyState()
    if (!state?.isActive) return
    if (!shouldCaptureByUrlFilter(entry.requestUrl)) return

    const log: ApiLogEntry = {
        id: generateLogId(),
        timestamp: new Date().toISOString(),
        method: entry.method,
        path: entry.path,
        status: entry.status,
        requestUrl: entry.requestUrl,
        targetUrl: entry.targetUrl,
        statusCode: entry.statusCode,
        duration: entry.duration,
        error: entry.error,
        responseBody: entry.responseBody,
        requestBody: entry.requestBody,
        requestHeaders: entry.requestHeaders,
        responseHeaders: entry.responseHeaders,
    }
    logs.push(log)
    broadcastLog(log, false)
}
