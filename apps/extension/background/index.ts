import { activateProxy, deactivateProxy, getProxyState, updateProxyEndpoints } from './proxy-engine'
import { initRequestLogger, getLogs, clearLogs, updateLogWithResponseBody } from './request-logger'
import { handleProxyFetch } from './proxy-fetch'
import { injectFetchPatch } from './inject-fetch-patch'
import { MAX_RESPONSE_BODY_SIZE, PROXY_APP_PREFIX } from './constants'

initRequestLogger()

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'inject-fetch-patch') {
    const tabId = sender.tab?.id
    const prefix = (message.payload as { prefix?: string } | undefined)?.prefix ?? PROXY_APP_PREFIX
    if (tabId != null) {
      chrome.scripting
        .executeScript({
          target: { tabId },
          world: 'MAIN',
          func: injectFetchPatch,
          args: [prefix, MAX_RESPONSE_BODY_SIZE],
        })
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }))
    } else {
      sendResponse({ ok: false, error: 'No tab' })
    }
    return true
  }
  if (message.type === 'response-body') {
    const { pathname, method, body } = (message.payload || {}) as { pathname?: string; method?: string; body?: string }
    if (pathname && method && body) {
      updateLogWithResponseBody(pathname, method, body)
    }
    sendResponse({ ok: true })
    return true
  }
  if (message.type === 'proxy-fetch') {
    const payload = (message.payload || {}) as Parameters<typeof handleProxyFetch>[0]
    handleProxyFetch(payload).then(sendResponse)
    return true
  }
  handleMessage(message).then(sendResponse)
  return true
})

async function handleMessage(message: { type: string; payload?: unknown }): Promise<unknown> {
  switch (message.type) {
    case 'start-server': {
      const { workspaceId, port, endpoints, variables, captureResourceTypes, urlMustContain } = (message.payload || {}) as {
        workspaceId: string
        port: number
        endpoints: unknown[]
        variables: Record<string, string>
        captureResourceTypes?: string[]
        urlMustContain?: string
      }
      // Extension: activate proxy with redirect to backend URLs directly (no proxyBaseUrl)
      const result = await activateProxy(
        workspaceId,
        endpoints as Parameters<typeof activateProxy>[1],
        variables,
        undefined,
        captureResourceTypes ?? ['xmlhttprequest'],
        urlMustContain
      )
      if (result.success) {
        broadcastServerLog(
          workspaceId,
          `Proxy activated (${result.ruleCount ?? 0} endpoints, content-script proxy)`,
          'success'
        )
      }
      return result
    }

    case 'stop-server': {
      const { workspaceId } = (message.payload || {}) as { workspaceId: string }
      await deactivateProxy()
      broadcastServerLog(workspaceId, 'Proxy deactivated', 'info')
      return { success: true }
    }

    case 'get-running-servers': {
      const state = getProxyState()
      return state?.isActive ? [state.workspaceId] : []
    }

    case 'get-proxy-status': {
      const state = getProxyState()
      return {
        isActive: state?.isActive ?? false,
        workspaceId: state?.workspaceId ?? null,
      }
    }

    case 'get-logs': {
      return { logs: getLogs() }
    }

    case 'clear-logs': {
      clearLogs()
      return { success: true }
    }

    case 'update-endpoints': {
      const { endpoints } = (message.payload || {}) as { endpoints: unknown[] }
      updateProxyEndpoints(endpoints as Parameters<typeof updateProxyEndpoints>[0])
      return { success: true }
    }

    default:
      return { error: `Unknown message type: ${message.type}` }
  }
}

function broadcastServerLog(workspaceId: string, message: string, type: 'info' | 'error' | 'success' = 'info') {
  try {
    chrome.runtime.sendMessage({
      type: 'server-log',
      payload: { workspaceId, message, type, timestamp: new Date().toLocaleTimeString() },
    }).catch(() => {})
  } catch {
    // Extension context invalidated or no receiver
  }
}
