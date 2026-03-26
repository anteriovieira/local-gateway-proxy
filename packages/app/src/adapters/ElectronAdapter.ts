import type { ProxyAdapter, StartServerParams, ServerLogPayload, ApiLogPayload } from '../ProxyAdapter'

declare global {
  interface Window {
    electron?: {
      ipcRenderer: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
        on: (channel: string, func: (...args: unknown[]) => void) => () => void
      }
    }
  }
}

export function createElectronAdapter(): ProxyAdapter {
  const ipc = typeof window !== 'undefined' ? window.electron?.ipcRenderer : null

  if (!ipc) {
    return {
      async startServer() {
        return { success: false, error: 'Electron IPC not available' }
      },
      async stopServer() {},
      async getRunningServers() {
        return []
      },
      onServerLog() {
        return () => {}
      },
      onApiLog() {
        return () => {}
      },
    }
  }

  return {
    async startServer(params: StartServerParams) {
      const result = (await ipc.invoke('start-server', params)) as { success: boolean; error?: string }
      return result ?? { success: false, error: 'No response' }
    },

    async stopServer(workspaceId: string) {
      await ipc.invoke('stop-server', { workspaceId })
    },

    async getRunningServers() {
      const ids = (await ipc.invoke('get-running-servers')) as string[]
      return ids ?? []
    },

    onServerLog(callback: (data: ServerLogPayload) => void) {
      return ipc.on('server-log', (data: unknown) => callback(data as ServerLogPayload))
    },

    onApiLog(callback: (data: ApiLogPayload) => void) {
      return ipc.on('api-log', (data: unknown) => callback(data as ApiLogPayload))
    },
  }
}
