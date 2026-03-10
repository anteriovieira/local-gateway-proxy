export interface EndpointDef {
    path: string
    method: string
    uriTemplate: string
    variableNames?: string[]
    enabled?: boolean
    isMock?: boolean
    mockResponse?: string
}

export interface Workspace {
    id: string
    name: string
    port: number
    configContent: string
    endpoints: EndpointDef[]
    variables: Record<string, string>
    isRunning: boolean
    /** ISO timestamp when server was last started (for duration calculation) */
    startedAt?: string
    logs: LogEntry[]
    apiLogs: ApiLogEntry[]
    integrationProperty?: string
    bypassEnabled?: boolean
    bypassUri?: string
    /** Resource types to capture (extension only). Default: ['xmlhttprequest'] for API calls. */
    captureResourceTypes?: string[]
    /** Incoming requests URL must contain this string to be captured (extension only). Empty = capture all. */
    urlMustContain?: string
}

export interface LogEntry {
    timestamp: string
    message: string
    type?: 'info' | 'error' | 'success'
}

export interface ApiLogEntry {
    id: string
    timestamp: string
    method: string
    path: string
    statusCode?: number
    status?: 'pending' | 'completed' | 'error'
    statusMessage?: string
    /** Original request URL (before proxy/redirect) */
    requestUrl?: string
    targetUrl?: string
    duration?: number
    requestId?: string
    ipAddress?: string
    userAgent?: string
    apiKey?: string
    idempotencyKey?: string
    responseBody?: string
    requestBody?: string
    isBypass?: boolean
    error?: string
    /** Request headers (key: value) */
    requestHeaders?: Record<string, string>
    /** Response headers (key: value) */
    responseHeaders?: Record<string, string>
}
