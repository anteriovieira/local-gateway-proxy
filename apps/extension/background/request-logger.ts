import type { ApiLogEntry } from '@proxy-app/shared'
import { resolveUrl } from '@proxy-app/shared'
import { getProxyState, findMatchingEndpoint } from './proxy-engine'

let logs: ApiLogEntry[] = []
let logIdCounter = 0
const pendingRequests = new Map<string, { startTime: number; logId: string }>()

function generateLogId(): string {
    return `log-${Date.now()}-${++logIdCounter}`
}

/** Tabs where the main-world fetch/XHR patch was injected (tabId -> result) */
const tabPatchStatus = new Map<number, { ok: boolean; error?: string; at: number }>()

/**
 * Page-side events seen before the matching webRequest log exists (the page patch asks the
 * background whether to proxy before the real XHR/fetch is sent). Consumed on onBeforeRequest.
 */
const earlyPageNotes: { url: string; method: string; note: string; at: number }[] = []
const EARLY_NOTE_TTL_MS = 60_000

function traceTime(): string {
    return new Date().toISOString().slice(11, 23)
}

function withTrace(log: ApiLogEntry, note: string): ApiLogEntry {
    return { ...log, captureTrace: [...(log.captureTrace ?? []), `${traceTime()} ${note}`] }
}

function sameUrl(a: string, b: string): boolean {
    try {
        const ua = new URL(a)
        const ub = new URL(b)
        return ua.origin === ub.origin && ua.pathname === ub.pathname && ua.search === ub.search
    } catch {
        return a === b
    }
}

export function setTabPatchStatus(tabId: number, ok: boolean, error?: string): void {
    tabPatchStatus.set(tabId, { ok, error, at: Date.now() })
}

/**
 * Record what the page patch did with a request (proxy check result, body capture, skip reason).
 * 'before' events happen before the request is sent, so they are always buffered until
 * onBeforeRequest creates the log; 'after' events attach to the most recent matching log.
 */
export function tracePageEvent(url: string, method: string, note: string, phase: 'before' | 'after'): void {
    const upper = method.toUpperCase()
    for (let i = phase === 'after' ? logs.length - 1 : -1; i >= 0; i--) {
        const log = logs[i]
        if (log.method.toUpperCase() !== upper || !log.requestUrl || !sameUrl(log.requestUrl, url)) continue
        if (Date.now() - new Date(log.timestamp).getTime() > EARLY_NOTE_TTL_MS) break
        logs[i] = withTrace(log, note)
        broadcastLog(logs[i], true)
        return
    }
    earlyPageNotes.push({ url, method: upper, note: `${traceTime()} ${note}`, at: Date.now() })
    if (earlyPageNotes.length > 200) earlyPageNotes.splice(0, earlyPageNotes.length - 200)
}

function takeEarlyPageNotes(url: string, method: string): string[] {
    const now = Date.now()
    const taken: string[] = []
    for (let i = earlyPageNotes.length - 1; i >= 0; i--) {
        const n = earlyPageNotes[i]
        if (now - n.at > EARLY_NOTE_TTL_MS) {
            earlyPageNotes.splice(i, 1)
        } else if (n.method === method.toUpperCase() && sameUrl(n.url, url)) {
            taken.unshift(n.note)
            earlyPageNotes.splice(i, 1)
        }
    }
    return taken
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
function headersToRecord(headers?: chrome.webRequest.HttpHeader[]): Record<string, string> | undefined {
    if (!headers || headers.length === 0) return undefined
    const record: Record<string, string> = {}
    for (const h of headers) {
        record[h.name] = h.value ?? (h.binaryValue ? '<binary>' : '')
    }
    return record
}

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
                const idx = logs.findIndex((l) => l.id === recentPending.id)
                if (idx >= 0) {
                    logs[idx] = withTrace(logs[idx], `webRequest: merged request ${details.requestId} (${details.url}) into this log (same path within 400ms)`)
                    broadcastLog(logs[idx], true)
                }
                return
            }

            const tabId = (details as { tabId?: number }).tabId ?? -1
            const trace: string[] = [
                `${traceTime()} webRequest: started (id ${details.requestId}, type ${requestType}, tab ${tabId}, initiator ${initiator ?? 'none'})`,
            ]
            if (tabId < 0) {
                trace.push(`${traceTime()} webRequest: not from a tab (extension/service worker request) — page patch cannot capture its body`)
            } else {
                const patch = tabPatchStatus.get(tabId)
                trace.push(
                    `${traceTime()} page patch for tab ${tabId}: ` +
                        (!patch
                            ? 'no injection recorded since service worker started (page not reloaded after extension reload, or service worker restarted)'
                            : patch.ok
                              ? `injected ${Math.round((now - patch.at) / 1000)}s ago`
                              : `injection FAILED: ${patch.error}`)
                )
            }
            trace.push(
                `${traceTime()} definitions: ` +
                    (match ? `matched ${match.endpoint.method} ${match.endpoint.path}${match.endpoint.isMock ? ' (mock)' : ''} -> ${targetUrl}` : 'no match (passthrough)')
            )
            const early = takeEarlyPageNotes(details.url, method)
            trace.push(...(early.length > 0 ? early : [`${traceTime()} page patch: no proxy check received for this URL before it was sent (patch not active or app bypassed patched fetch/XHR)`]))

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
                ...(requestBody && { requestBody }),
                captureTrace: trace,
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

    // Record request headers as sent (after other extensions/DNR rules modified them)
    chrome.webRequest.onSendHeaders.addListener(
        (details) => {
            const pending = pendingRequests.get(details.requestId)
            if (!pending) return
            const requestHeaders = headersToRecord(details.requestHeaders)
            if (!requestHeaders) return
            const logIndex = logs.findIndex(l => l.id === pending.logId)
            if (logIndex < 0) return
            logs[logIndex] = { ...logs[logIndex], requestHeaders }
            broadcastLog(logs[logIndex], true)
        },
        { urls: ['<all_urls>'] },
        ['requestHeaders', 'extraHeaders']
    )

    // Log when a request completes
    chrome.webRequest.onCompleted.addListener(
        (details) => {
            const pending = pendingRequests.get(details.requestId)
            if (!pending) return

            const duration = Date.now() - pending.startTime
            const logIndex = logs.findIndex(l => l.id === pending.logId)
            if (logIndex >= 0) {
                logs[logIndex] = withTrace(
                    {
                        ...logs[logIndex],
                        status: 'completed',
                        statusCode: details.statusCode,
                        duration,
                        ...(details.responseHeaders && { responseHeaders: headersToRecord(details.responseHeaders) }),
                    },
                    `webRequest: completed ${details.statusCode} in ${duration}ms` +
                        (logs[logIndex].responseBody ? ' (body already captured)' : ' (waiting for body from page)')
                )
                broadcastLog(logs[logIndex], true)
            }

            pendingRequests.delete(details.requestId)
        },
        { urls: ['<all_urls>'] },
        ['responseHeaders', 'extraHeaders']
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
            logs[logIndex] = withTrace(
                {
                    ...logs[logIndex],
                    status: 'error',
                    error: details.error,
                    duration
                },
                `webRequest: error ${details.error}`
            )
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
 * The page's load event can reach us before webRequest.onCompleted, so if no finished log
 * matches, the body is attached to the oldest matching pending log and kept when it completes.
 */
export function updateLogWithResponseBody(pathname: string, method: string, body: string, url?: string): void {
    const state = getProxyState()
    if (!state?.isActive) {
        console.debug('[proxy-app] response body dropped: proxy inactive', method, pathname)
        return
    }

    const matches = (log: ApiLogEntry): boolean => {
        if (log.responseBody || log.method.toUpperCase() !== method.toUpperCase()) return false
        if (log.path === pathname) return true
        if (!log.targetUrl) return false
        try {
            return new URL(log.targetUrl).pathname === pathname
        } catch {
            return false
        }
    }

    let index = -1
    for (let i = logs.length - 1; i >= 0; i--) {
        if ((logs[i].status === 'completed' || logs[i].status === 'error') && matches(logs[i])) {
            index = i
            break
        }
    }
    if (index < 0) {
        index = logs.findIndex((l) => l.status === 'pending' && matches(l))
    }
    if (index < 0) {
        console.debug('[proxy-app] response body dropped: no log without body matches', method, pathname)
        if (url) tracePageEvent(url, method, `page: body received (${body.length} chars) but no log without body matched ${method} ${pathname}`, 'after')
        return
    }

    logs[index] = withTrace(
        { ...logs[index], responseBody: body },
        `page: body received (${body.length} chars), attached while log was ${logs[index].status}`
    )
    broadcastLog(logs[index], true)
}

/**
 * Clear all logs.
 */
export function clearLogs(): void {
    logs = []
    pendingRequests.clear()
}

/**
 * Drop logs that don't match the current URL filter (called when the filter changes).
 */
export function pruneLogsByUrlFilter(): void {
    const kept = logs.filter((l) => shouldCaptureByUrlFilter(l.requestUrl ?? l.path))
    if (kept.length === logs.length) return
    const keptIds = new Set(kept.map((l) => l.id))
    for (const [requestId, pending] of pendingRequests) {
        if (!keptIds.has(pending.logId)) pendingRequests.delete(requestId)
    }
    logs = kept
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
    isMock?: boolean
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
        isMock: entry.isMock,
        captureTrace: [
            ...takeEarlyPageNotes(entry.requestUrl, entry.method),
            `${traceTime()} proxy: ${entry.isMock ? 'mock response served' : `fetched by extension -> ${entry.targetUrl}`} (${entry.statusCode ?? entry.error ?? entry.status}), body ${entry.responseBody != null ? `${entry.responseBody.length} chars` : 'none'}`,
        ],
    }
    logs.push(log)
    broadcastLog(log, false)
}
