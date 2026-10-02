import { activateProxy, deactivateProxy, getProxyState, updateProxyEndpoints, updateProxyUrlFilter, restoreProxyState } from './proxy-engine'
import { initRequestLogger, getLogs, clearLogs, updateLogWithResponseBody, setTabPatchStatus, tracePageEvent } from './request-logger'
import { handleProxyFetch, initMockDb, destroyMockDb, getMockDb, restoreMockDb } from './proxy-fetch'
import { injectFetchPatch } from './inject-fetch-patch'
import { MAX_RESPONSE_BODY_SIZE, PROXY_APP_PREFIX } from './constants'
import type { MockDbSnapshot } from '@proxy-app/shared'

initRequestLogger()

// Restore proxy state and mock database from session storage on service worker startup
const stateReady = Promise.all([restoreProxyState(), restoreMockDb()]).then(() => {
  const state = getProxyState()
  updateBadge(state?.isActive ? 1 : 0)
})

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)
  if (reason === 'install' || reason === 'update') reinjectContentScripts()
})

/**
 * Chrome doesn't re-inject content scripts into open tabs after an install/update/reload, so the
 * old content script is orphaned and page-captured response bodies are silently dropped. The
 * main-world patch survives (guarded) and keeps posting messages, so a fresh content script picks them up.
 */
async function reinjectContentScripts(): Promise<void> {
  // MAIN-world scripts can't be re-run with executeScript's default (isolated) world; the bridge
  // re-requests the patch via 'inject-fetch-patch' if it's missing
  const files =
    chrome.runtime
      .getManifest()
      .content_scripts?.filter((cs) => (cs as { world?: string }).world !== 'MAIN')
      .flatMap((cs) => cs.js ?? []) ?? []
  if (files.length === 0) return
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })
  for (const tab of tabs) {
    if (tab.id == null) continue
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files }).catch(() => {})
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'inject-fetch-patch') {
    const tabId = sender.tab?.id
    const { prefix = PROXY_APP_PREFIX, alreadyPatched } = (message.payload ?? {}) as { prefix?: string; alreadyPatched?: boolean }
    if (tabId != null && tabId >= 0 && alreadyPatched) {
      setTabPatchStatus(tabId, true)
      sendResponse({ ok: true })
      return true
    }
    if (tabId != null && tabId >= 0) {
      chrome.scripting
        .executeScript({
          target: { tabId },
          world: 'MAIN',
          func: injectFetchPatch,
          args: [prefix, MAX_RESPONSE_BODY_SIZE],
        })
        .then(() => {
          setTabPatchStatus(tabId, true)
          sendResponse({ ok: true })
        })
        .catch((err) => {
          setTabPatchStatus(tabId, false, String(err))
          console.warn('[proxy-app] fetch patch injection failed', tabId, err)
          sendResponse({ ok: false, error: String(err) })
        })
    } else {
      sendResponse({ ok: false, error: 'No tab' })
    }
    return true
  }
  if (message.type === 'response-body') {
    const { url, pathname, method, body } = (message.payload || {}) as { url?: string; pathname?: string; method?: string; body?: string }
    stateReady.then(() => {
      if (pathname && method && body) {
        updateLogWithResponseBody(pathname, method, body, url)
      }
      sendResponse({ ok: true })
    })
    return true
  }
  if (message.type === 'response-body-skip') {
    const { url, method, reason } = (message.payload || {}) as { url?: string; method?: string; reason?: string }
    stateReady.then(() => {
      if (url && method) tracePageEvent(url, method, `page: body NOT captured — ${reason ?? 'unknown reason'}`, 'after')
      sendResponse({ ok: true })
    })
    return true
  }
  if (message.type === 'proxy-fetch') {
    const payload = (message.payload || {}) as Parameters<typeof handleProxyFetch>[0]
    stateReady.then(() => handleProxyFetch(payload)).then(sendResponse)
    return true
  }
  handleMessage(message).then(sendResponse)
  return true
})

async function handleMessage(message: { type: string; payload?: unknown }): Promise<unknown> {
  switch (message.type) {
    case 'start-server': {
      const { workspaceId, port, endpoints, variables, captureResourceTypes, urlMustContain, mockDbConfig } = (message.payload || {}) as {
        workspaceId: string
        port: number
        endpoints: unknown[]
        variables: Record<string, string>
        captureResourceTypes?: string[]
        urlMustContain?: string
        mockDbConfig?: { initialData: string }
      }

      // Initialize mock database if configured
      if (mockDbConfig?.initialData) {
        try {
          const snapshot = JSON.parse(mockDbConfig.initialData) as MockDbSnapshot
          initMockDb(snapshot)
        } catch (err) {
          console.warn('[background] Failed to parse mock-db initial data:', err)
        }
      } else {
        destroyMockDb()
      }

      // Extension: activate proxy with redirect to backend URLs directly (no proxyBaseUrl)
      const result = await activateProxy(
        workspaceId,
        endpoints as Parameters<typeof activateProxy>[1],
        variables,
        undefined,
        captureResourceTypes ?? ['xmlhttprequest'],
        urlMustContain,
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
      destroyMockDb()
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

    case 'update-badge': {
      const { count } = (message.payload || {}) as { count: number }
      updateBadge(count ?? 0)
      return { success: true }
    }

    case 'update-endpoints': {
      const { endpoints } = (message.payload || {}) as { endpoints: unknown[] }
      updateProxyEndpoints(endpoints as Parameters<typeof updateProxyEndpoints>[0])
      return { success: true }
    }

    case 'update-url-filter': {
      const { urlMustContain } = (message.payload || {}) as { urlMustContain?: string }
      updateProxyUrlFilter(urlMustContain)
      return { success: true }
    }

    case 'get-mock-db': {
      const db = getMockDb()
      return { data: db ? db.toSnapshot() : null }
    }

    case 'update-mock-db': {
      const { initialData } = (message.payload || {}) as { initialData: string }
      if (!initialData) {
        destroyMockDb()
        return { success: true }
      }
      try {
        const snapshot = JSON.parse(initialData) as MockDbSnapshot
        initMockDb(snapshot)
        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }

    default:
      return { error: `Unknown message type: ${message.type}` }
  }
}

function updateBadge(count: number) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) })
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' })
  } else {
    chrome.action.setBadgeText({ text: '' })
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
