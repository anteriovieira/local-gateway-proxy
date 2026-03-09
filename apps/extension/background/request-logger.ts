import type { ApiLogEntry } from '@proxy-app/shared'
import { getProxyState } from './proxy-engine'

let logs: ApiLogEntry[] = []
let logIdCounter = 0
const pendingRequests = new Map<string, { startTime: number; logId: string }>()

function generateLogId(): string {
    return `log-${Date.now()}-${++logIdCounter}`
}

/**
 * Initialize webRequest listeners for logging intercepted requests.
 */
export function initRequestLogger(): void {
    // Log when a request starts
    chrome.webRequest.onBeforeRequest.addListener(
        (details) => {
            const logId = generateLogId()
            const entry: ApiLogEntry = {
                id: logId,
                timestamp: new Date().toISOString(),
                method: details.method,
                path: new URL(details.url).pathname,
                status: 'pending',
                targetUrl: details.url
            }

            pendingRequests.set(details.requestId, {
                startTime: Date.now(),
                logId
            })

            logs.push(entry)
            broadcastLog(entry, false)
        },
        { urls: ['<all_urls>'] }
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

            const duration = Date.now() - pending.startTime
            const logIndex = logs.findIndex(l => l.id === pending.logId)
            if (logIndex >= 0) {
                logs[logIndex] = {
                    ...logs[logIndex],
                    status: 'error',
                    error: details.error,
                    duration
                }
                broadcastLog(logs[logIndex], true)
            }

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
    chrome.runtime.sendMessage({
        type: 'api-log',
        payload: { workspaceId, apiLog: log, isUpdate }
    }).catch(() => {
        // Side panel might not be open, ignore
    })
}

/**
 * Get all current logs.
 */
export function getLogs(): ApiLogEntry[] {
    return logs
}

/**
 * Clear all logs.
 */
export function clearLogs(): void {
    logs = []
    pendingRequests.clear()
}
