import type { EndpointDef } from '@proxy-app/shared'
import { resolveUrl, matchPath } from '@proxy-app/shared'

export interface ProxyState {
    workspaceId: string
    endpoints: EndpointDef[]
    variables: Record<string, string>
    isActive: boolean
    captureResourceTypes: string[]
}

let currentState: ProxyState | null = null
let ruleIdCounter = 1

/**
 * Get the current proxy state
 */
export function getProxyState(): ProxyState | null {
    return currentState
}

/**
 * Parse proxy base URL (e.g. "http://localhost:3000") into transform parts.
 */
function parseProxyBaseUrl(proxyBaseUrl: string): { scheme: string; host: string; port: string } | null {
    try {
        const url = new URL(proxyBaseUrl)
        return {
            scheme: url.protocol.replace(':', '') || 'http',
            host: url.hostname || 'localhost',
            port: url.port || (url.protocol === 'https:' ? '443' : '80')
        }
    } catch {
        return null
    }
}

/**
 * Activate the proxy for a workspace.
 * - When proxyBaseUrl is set: uses declarativeNetRequest to redirect to desktop proxy (localhost).
 * - When proxyBaseUrl is omitted (standalone): uses content script fetch override to proxy through
 *   the extension background (avoids CORS by making the request from extension context).
 */
export async function activateProxy(
    workspaceId: string,
    endpoints: EndpointDef[],
    variables: Record<string, string>,
    proxyBaseUrl?: string,
    captureResourceTypes: string[] = ['xmlhttprequest']
): Promise<{ success: boolean; error?: string; ruleCount?: number }> {
    try {
        // Clear existing rules first
        await clearAllRules()

        const enabledEndpoints = endpoints.filter(ep => ep.enabled !== false && !ep.isMock)
        const transform = proxyBaseUrl ? parseProxyBaseUrl(proxyBaseUrl) : null

        // Only use declarativeNetRequest when redirecting to desktop proxy.
        // In standalone mode, content script intercepts fetch and proxies through background.
        if (transform) {
            const rules: chrome.declarativeNetRequest.Rule[] = []
            for (const ep of enabledEndpoints) {
                try {
                    const rule: chrome.declarativeNetRequest.Rule = {
                        id: ruleIdCounter++,
                        priority: 1,
                        action: {
                            type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
                            redirect: { transform: { scheme: transform.scheme, host: transform.host, port: transform.port } }
                        },
                        condition: {
                            urlFilter: pathToUrlFilter(ep.path),
                            resourceTypes: captureResourceTypes.length > 0
                                ? (captureResourceTypes as chrome.declarativeNetRequest.ResourceType[])
                                : [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
                        }
                    }
                    const method = ep.method.toUpperCase()
                    if (method !== 'ANY' && method !== 'ALL') {
                        rule.condition.requestMethods = [method.toLowerCase() as chrome.declarativeNetRequest.RequestMethod]
                    }
                    rules.push(rule)
                } catch (err) {
                    console.warn(`[proxy-engine] Skipping endpoint ${ep.method} ${ep.path}:`, err)
                }
            }
            if (rules.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({
                    addRules: rules,
                    removeRuleIds: []
                })
            }
            console.log(`[proxy-engine] Activated ${rules.length} redirect rules for workspace ${workspaceId}`)
        } else {
            console.log(`[proxy-engine] Activated content-script proxy for ${enabledEndpoints.length} endpoints (standalone mode)`)
        }

        currentState = {
            workspaceId,
            endpoints,
            variables,
            isActive: true,
            captureResourceTypes
        }

        return { success: true, ruleCount: transform ? enabledEndpoints.length : enabledEndpoints.length }
    } catch (err: any) {
        console.error('[proxy-engine] Failed to activate proxy:', err)
        return { success: false, error: err.message || 'Failed to activate proxy' }
    }
}

/**
 * Deactivate the proxy, removing all redirect rules.
 */
export async function deactivateProxy(): Promise<void> {
    await clearAllRules()
    if (currentState) {
        currentState.isActive = false
    }
    currentState = null
    console.log('[proxy-engine] Proxy deactivated')
}

/**
 * Clear all dynamic declarativeNetRequest rules.
 */
async function clearAllRules(): Promise<void> {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
    if (existingRules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRules.map(r => r.id),
            addRules: []
        })
    }
}

/**
 * Convert an API path pattern to a URL filter for declarativeNetRequest.
 * e.g., /users/{id}/orders -> * /users/* /orders
 * Path parameters become wildcards.
 */
function pathToUrlFilter(path: string): string {
    // Replace {param} with wildcard *
    const filterPath = path.replace(/\{[a-zA-Z0-9_]+\}/g, '*')
    return '*' + filterPath
}

/**
 * Match an incoming request URL against configured endpoints.
 * Returns the matching endpoint and extracted path params, or null.
 */
export function findMatchingEndpoint(
    requestPath: string,
    method: string,
    endpoints: EndpointDef[]
): { endpoint: EndpointDef; params: Record<string, string> } | null {
    for (const ep of endpoints) {
        if (ep.enabled === false) continue
        if (ep.method.toUpperCase() !== method.toUpperCase() && ep.method.toUpperCase() !== 'ANY') continue

        const params = matchPath(ep.path, requestPath)
        if (params !== null) {
            return { endpoint: ep, params }
        }
    }
    return null
}
