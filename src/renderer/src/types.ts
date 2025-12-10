export interface EndpointDef {
    path: string
    method: string
    uriTemplate: string
    variableNames?: string[]
    enabled?: boolean // New field for toggling
}

export interface Workspace {
    id: string
    name: string
    port: number
    configContent: string
    endpoints: EndpointDef[]
    variables: Record<string, string>
    isRunning: boolean
    logs: LogEntry[]
    apiLogs: ApiLogEntry[]
    integrationProperty?: string // Property name to extract integration (e.g., "x-amazon-apigateway-integration")
    bypassEnabled?: boolean // When true, disabled endpoints will bypass to bypassUri
    bypassUri?: string // URI to redirect disabled endpoints when bypass is enabled
    systemProxyEnabled?: boolean // When true, configures system proxy to route all HTTP/HTTPS requests through local proxy
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
    statusCode: number
    statusMessage?: string
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
}
