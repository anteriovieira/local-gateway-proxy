import type { EndpointDef, ApiLogEntry, MockDbConfig, MockDbSnapshot } from '@proxy-app/shared'

export interface ServerLogPayload {
  workspaceId: string
  message: string
  type: 'info' | 'error' | 'success'
  timestamp: string
}

export interface ApiLogPayload {
  workspaceId: string
  apiLog: ApiLogEntry & { id?: string }
  isUpdate?: boolean
}

export interface StartServerParams {
  workspaceId: string
  port: number
  endpoints: EndpointDef[]
  variables: Record<string, string>
  bypassEnabled?: boolean
  bypassUri?: string
  captureResourceTypes?: string[]
  /** Incoming requests URL must contain this string to be captured (extension only). */
  urlMustContain?: string
  /** Mock database configuration for CRUD simulation */
  mockDbConfig?: MockDbConfig
}

export interface ProxyAdapter {
  startServer(params: StartServerParams): Promise<{ success: boolean; error?: string }>
  stopServer(workspaceId: string): Promise<void>
  getRunningServers(): Promise<string[]>
  onServerLog(callback: (data: ServerLogPayload) => void): () => void
  onApiLog(callback: (data: ApiLogPayload) => void): () => void
  updateEndpoints?(endpoints: EndpointDef[]): Promise<void>
  updateUrlFilter?(urlMustContain?: string): Promise<void>
  updateMockDb?(initialData: string): Promise<void>
  onMockDbUpdate?(callback: (snapshot: MockDbSnapshot) => void): () => void
}
