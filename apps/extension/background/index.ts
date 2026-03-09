import { activateProxy, deactivateProxy, getProxyState } from './proxy-engine'
import { initRequestLogger, getLogs, clearLogs } from './request-logger'

initRequestLogger()

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse)
  return true
})

async function handleMessage(message: { type: string; payload?: unknown }): Promise<unknown> {
  switch (message.type) {
    case 'start-server': {
      const { workspaceId, port, endpoints, variables } = (message.payload || {}) as {
        workspaceId: string
        port: number
        endpoints: unknown[]
        variables: Record<string, string>
      }
      // Extension: activate proxy with redirect to backend URLs directly (no proxyBaseUrl)
      const result = await activateProxy(workspaceId, endpoints as Parameters<typeof activateProxy>[1], variables)
      if (result.success) {
        broadcastServerLog(workspaceId, `Proxy activated with ${result.ruleCount ?? 0} redirect rules`, 'success')
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

    case 'activate-proxy': {
      // Legacy: connect to desktop - no longer used (extension is standalone)
      const { workspaceId, endpoints, variables, proxyBaseUrl } = (message.payload || {}) as {
        workspaceId: string
        endpoints: unknown[]
        variables: Record<string, string>
        proxyBaseUrl?: string
      }
      return activateProxy(workspaceId, endpoints as Parameters<typeof activateProxy>[1], variables, proxyBaseUrl)
    }

    case 'deactivate-proxy': {
      await deactivateProxy()
      return { success: true }
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

    default:
      return { error: `Unknown message type: ${message.type}` }
  }
}

function broadcastServerLog(workspaceId: string, message: string, type: 'info' | 'error' | 'success' = 'info') {
  chrome.runtime.sendMessage({
    type: 'server-log',
    payload: { workspaceId, message, type, timestamp: new Date().toLocaleTimeString() },
  }).catch(() => {})
}
