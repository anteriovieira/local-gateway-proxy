import type { ProxyAdapter, ServerLogPayload, ApiLogPayload } from '../ProxyAdapter'
import type { MockDbSnapshot } from '@proxy-app/shared'

export function createChromeAdapter(): ProxyAdapter {
  const sendMessage = <T>(type: string, payload?: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(response as T)
        }
      })
    })
  }

  return {
    async startServer(params) {
      const result = await sendMessage<{ success: boolean; error?: string }>('start-server', params)
      return result ?? { success: false, error: 'No response' }
    },

    async stopServer(workspaceId: string) {
      await sendMessage('stop-server', { workspaceId })
    },

    async getRunningServers() {
      const ids = await sendMessage<string[]>('get-running-servers')
      return ids ?? []
    },

    onServerLog(callback: (data: ServerLogPayload) => void) {
      const handler = (message: { type: string; payload?: ServerLogPayload }) => {
        if (message.type === 'server-log' && message.payload) {
          callback(message.payload)
        }
      }
      chrome.runtime.onMessage.addListener(handler)
      return () => chrome.runtime.onMessage.removeListener(handler)
    },

    onApiLog(callback: (data: ApiLogPayload) => void) {
      const handler = (message: { type: string; payload?: ApiLogPayload }) => {
        if (message.type === 'api-log' && message.payload) {
          callback(message.payload)
        }
      }
      chrome.runtime.onMessage.addListener(handler)
      return () => chrome.runtime.onMessage.removeListener(handler)
    },

    async updateEndpoints(endpoints) {
      await sendMessage('update-endpoints', { endpoints })
    },

    async updateUrlFilter(urlMustContain?: string) {
      await sendMessage('update-url-filter', { urlMustContain })
    },

    async updateMockDb(initialData: string) {
      await sendMessage('update-mock-db', { initialData })
    },

    onMockDbUpdate(callback: (snapshot: MockDbSnapshot) => void) {
      const handler = (message: { type: string; payload?: { snapshot: MockDbSnapshot } }) => {
        if (message.type === 'mock-db-updated' && message.payload?.snapshot) {
          callback(message.payload.snapshot)
        }
      }
      chrome.runtime.onMessage.addListener(handler)
      return () => chrome.runtime.onMessage.removeListener(handler)
    },
  }
}
