import { Server } from 'http'
import type { Request, Response, Application } from 'express'
import type { BrowserWindow } from 'electron'

// Use require for CommonJS compatibility with Electron main process
const express = require('express')
const cors = require('cors')
const httpProxy = require('http-proxy')
const zlib = require('zlib')
const { Buffer } = require('buffer')
const { PassThrough, Readable } = require('stream')

const proxy = httpProxy.createProxyServer({})

// Handle proxy errors to prevent crash
proxy.on('error', (err: Error, req: any, res: any) => {
    console.error('Proxy error:', err)
    if ('headersSent' in res && !res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Proxy error', message: err.message }))
    }
})

// Helper function to send logs to renderer
function sendLog(workspaceId: string, message: string, type: 'info' | 'error' | 'success' = 'info', mainWindow: BrowserWindow | null) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-log', {
            workspaceId,
            message,
            type,
            timestamp: new Date().toLocaleTimeString()
        })
    }
    // Also log to console for debugging
    console.log(`[Workspace ${workspaceId}] ${message}`)
}

// Helper function to send API logs to renderer
// If logId and isUpdate are provided, it will update an existing log entry; otherwise creates a new one
function sendApiLog(workspaceId: string, apiLog: {
    method: string
    path: string
    statusCode?: number
    status?: 'pending' | 'completed' | 'error'
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
    timestamp?: string
}, mainWindow: BrowserWindow | null, logId?: string, isUpdate: boolean = false) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        const finalId = logId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        mainWindow.webContents.send('api-log', {
            workspaceId,
            apiLog: {
                id: finalId,
                ...apiLog,
                timestamp: apiLog.timestamp || new Date().toISOString()
            },
            isUpdate: isUpdate && !!logId // Only update if explicitly requested and logId exists
        })
    }
}

export class ServerManager {
    private servers: Map<string, Server> = new Map()

    getRunningServers(): string[] {
        return Array.from(this.servers.keys())
    }

    startServer(workspaceId: string, port: number, endpoints: any[], variables: Record<string, string>, bypassEnabled: boolean = false, bypassUri: string = '', mainWindow: BrowserWindow | null = null) {
        return new Promise<void>((resolve, reject) => {
            // Stop existing server for this workspace if any
            if (this.servers.has(workspaceId)) {
                this.servers.get(workspaceId)?.close()
                this.servers.delete(workspaceId)
            }

            const app = express()
            app.use(cors())
            // Don't use bodyParser.json() globally as it consumes the stream
            // We'll buffer the body manually for logging in the route handlers

            // Helper to replace variables
            const resolveUrl = (template: string, params: Record<string, string>) => {
                let url = template
                const missingVariables: string[] = []
                
                // Replace variables
                // Variables are stored with the name as it appears in the template
                // (e.g., "userId" or "stageVariables.userId")
                for (const [key, val] of Object.entries(variables)) {
                    // key is the variable name as it appears in the template
                    // Replace ${key} with the value
                    const placeholder = '${' + key + '}'
                    if (url.includes(placeholder)) {
                        if (!val || val.trim() === '') {
                            missingVariables.push(key)
                        } else {
                            let normalizedVal = val.trim()
                            
                            // If the template already has a protocol (http:// or https://) before the variable,
                            // and the variable value also includes a protocol, strip it from the value
                            const placeholderIndex = url.indexOf(placeholder)
                            const beforePlaceholder = url.substring(0, placeholderIndex)
                            
                            // Check if template has protocol before the variable
                            const hasProtocolInTemplate = /https?:\/\/$/.test(beforePlaceholder)
                            
                            // Check if variable value has protocol
                            if (hasProtocolInTemplate && /^https?:\/\//.test(normalizedVal)) {
                                // Remove protocol from variable value
                                normalizedVal = normalizedVal.replace(/^https?:\/\//, '')
                            }
                            
                            // Escape special regex characters in key for safe replacement
                            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                            url = url.replace(new RegExp('\\$\\{' + escapedKey + '\\}', 'g'), normalizedVal)
                        }
                    }
                }
                
                // Check for any unresolved variables
                const unresolvedVarRegex = /\$\{([a-zA-Z0-9_.]+)\}/g
                let match
                while ((match = unresolvedVarRegex.exec(url)) !== null) {
                    const varName = match[1]
                    if (!missingVariables.includes(varName)) {
                        missingVariables.push(varName)
                    }
                }
                
                // Replace path params
                for (const [key, val] of Object.entries(params)) {
                    url = url.replace('{' + key + '}', val || '')
                }
                
                // Check for any unresolved path params
                const unresolvedPathRegex = /\{([a-zA-Z0-9_]+)\}/g
                while ((match = unresolvedPathRegex.exec(url)) !== null) {
                    const paramName = match[1]
                    // Path params might be optional, so we don't error on them
                    // But we should log a warning if they're missing
                }
                
                // Throw error if required variables are missing
                if (missingVariables.length > 0) {
                    throw new Error(
                        `Missing or empty required variables: ${missingVariables.join(', ')}. ` +
                        `Please set these variables in the Variables tab.`
                    )
                }
                
                return url
            }

            // Helper to match path pattern
            const matchPath = (pattern: string, path: string): Record<string, string> | null => {
                const patternParts = pattern.split('/')
                const pathParts = path.split('/')
                
                if (patternParts.length !== pathParts.length) return null
                
                const params: Record<string, string> = {}
                for (let i = 0; i < patternParts.length; i++) {
                    const patternPart = patternParts[i]
                    const pathPart = pathParts[i]
                    
                    const paramMatch = patternPart.match(/^{([a-zA-Z0-9_]+)}$/)
                    if (paramMatch) {
                        params[paramMatch[1]] = pathPart
                    } else if (patternPart !== pathPart) {
                        return null
                    }
                }
                return params
            }

            // Register enabled endpoints (normal proxy behavior)
            endpoints.forEach((ep: any) => {
                if (ep.enabled === false) return // Skip disabled endpoints for normal routing
                
                // Allow for express style path params: /users/{id} -> /users/:id
                const expressPath = ep.path.replace(/{([a-zA-Z0-9_]+)}/g, ':$1')
                const method = ep.method.toLowerCase()

                if ((app as any)[method]) {
                    (app as any)[method](expressPath, (req: Request, res: Response) => {
                        // Capture the original requested path BEFORE modifying req.url
                        // Declare outside try block so it's accessible in catch block
                        const requestedPath = req.path
                        
                        // Generate unique log ID for this request (outside try block for error handling)
                        const logId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                        
                        try {
                            const startTime = Date.now()
                            const targetUrl = resolveUrl(ep.uriTemplate, req.params as Record<string, string>)

                            // Capture request details
                            const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'
                            const userAgent = req.get('user-agent') || 'unknown'
                            const apiKey = req.get('authorization')?.replace(/^Bearer /, '') || req.get('x-api-key') || undefined
                            const idempotencyKey = req.get('idempotency-key') || req.get('x-idempotency-key') || undefined

                            // Send initial API log with pending status (create new entry)
                            sendApiLog(workspaceId, {
                                method: req.method,
                                path: requestedPath,
                                status: 'pending',
                                targetUrl,
                                ipAddress,
                                userAgent,
                                apiKey: apiKey ? (apiKey.length > 20 ? apiKey.substring(0, 20) + '...' : apiKey) : undefined,
                                idempotencyKey,
                                isBypass: false,
                                timestamp: new Date().toISOString()
                            }, mainWindow, logId, false) // false = create new entry

                            // Capture request body
                            // Note: This approach collects chunks as they flow through the stream.
                            // Both our listener and http-proxy should receive the data if both
                            // listeners are attached before data starts flowing.
                            let requestBody = ''
                            const requestChunks: Buffer[] = []
                            
                            // Only capture body for methods that typically have bodies
                            const hasBody = ['POST', 'PUT', 'PATCH'].includes(req.method)
                            
                            if (hasBody && req.readable) {
                                // Collect chunks as they arrive
                                req.on('data', (chunk: Buffer) => {
                                    requestChunks.push(Buffer.from(chunk))
                                })
                                
                                req.on('end', () => {
                                    // Decode the captured body
                                    if (requestChunks.length > 0) {
                                        try {
                                            const buffer = Buffer.concat(requestChunks)
                                            requestBody = buffer.toString('utf8')
                                        } catch (err: any) {
                                            requestBody = `<unable to decode request body: ${err.message}>`
                                        }
                                    }
                                })
                            }

                            // Send log to renderer
                            sendLog(workspaceId, `${req.method} ${requestedPath} -> ${targetUrl}`, 'info', mainWindow)

                            // We need to parse target to get base for http-proxy
                            // Note: if targetUrl is invalid, this throws
                            const urlObj = new URL(targetUrl)
                            const targetBase = `${urlObj.protocol}//${urlObj.host}`
                            const targetPath = urlObj.pathname + urlObj.search

                            // Rewrite req.url for the proxy
                            req.url = targetPath

                            // Add response logging
                            let responseBody = ''
                            let responseChunks: Buffer[] = []
                            let statusCode = res.statusCode || 200
                            let contentEncoding = ''

                            // Helper function to decode response body
                            const decodeResponseBody = (chunks: Buffer[], encoding: string): string => {
                                if (chunks.length === 0) return ''
                                
                                try {
                                    const buffer = Buffer.concat(chunks)
                                    
                                    // http-proxy typically auto-decompresses, but check content-encoding anyway
                                    let dataToDecode: Buffer = buffer
                                    
                                    // Only try decompression if we have an encoding header and data
                                    if (encoding && buffer.length > 0) {
                                        try {
                                            if (encoding === 'gzip') {
                                                dataToDecode = zlib.gunzipSync(buffer)
                                            } else if (encoding === 'deflate') {
                                                dataToDecode = zlib.inflateSync(buffer)
                                            } else if (encoding === 'br') {
                                                dataToDecode = zlib.brotliDecompressSync(buffer)
                                            }
                                        } catch (decompErr) {
                                            // Decompression failed, try with buffer as-is
                                            // (likely already decompressed by http-proxy)
                                        }
                                    }
                                    
                                    // Try UTF-8 decoding
                                    try {
                                        const text = dataToDecode.toString('utf8')
                                        // Basic validation: check if it's mostly printable characters
                                        // Allow some control chars (newlines, tabs, etc.)
                                        const nonPrintableCount = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g) || []).length
                                        const totalLength = text.length
                                        
                                        // If less than 5% non-printable, consider it valid text
                                        if (totalLength === 0 || nonPrintableCount / totalLength < 0.05) {
                                            return text
                                        }
                                    } catch (utf8Err) {
                                        // UTF-8 decode failed, will fall through to binary handling
                                    }
                                    
                                    // If it looks like binary data, check content-type to decide
                                    // For JSON/text responses, force UTF-8 even if it looks binary
                                    // This handles cases where valid UTF-8 might have some control chars
                                    try {
                                        const text = dataToDecode.toString('utf8')
                                        // For JSON, be more lenient
                                        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                                            return text
                                        }
                                    } catch (e) {
                                        // Ignore
                                    }
                                    
                                    // Last resort: return as-is with UTF-8, even if it might look garbled
                                    // This is better than showing base64 for text responses
                                    return dataToDecode.toString('utf8')
                                } catch (err: any) {
                                    return `<unable to decode response body: ${err.message}>`
                                }
                            }

                            // Listen to proxy response event to capture headers
                            const proxyResHandler = (proxyRes: any) => {
                                statusCode = proxyRes.statusCode || 200
                                contentEncoding = (proxyRes.headers['content-encoding'] || res.getHeader('content-encoding') || '').toString().toLowerCase()
                            }

                            proxy.once('proxyRes', proxyResHandler)
                            
                            // Also check response headers as fallback
                            const originalSetHeader = res.setHeader.bind(res)
                            res.setHeader = function(name: string, value: any) {
                                if (name.toLowerCase() === 'content-encoding' && !contentEncoding) {
                                    contentEncoding = value.toString().toLowerCase()
                                }
                                return originalSetHeader(name, value)
                            }

                            // Intercept response data at the proxy level
                            const originalWrite = res.write.bind(res)
                            const originalEnd = res.end.bind(res)

                            res.write = function(chunk: any, encoding?: any) {
                                if (chunk) {
                                    if (Buffer.isBuffer(chunk)) {
                                        responseChunks.push(chunk)
                                    } else {
                                        responseChunks.push(Buffer.from(chunk, encoding || 'utf8'))
                                    }
                                }
                                return originalWrite(chunk, encoding)
                            }

                            res.end = function(chunk?: any, encoding?: any) {
                                if (chunk) {
                                    if (Buffer.isBuffer(chunk)) {
                                        responseChunks.push(chunk)
                                    } else {
                                        responseChunks.push(Buffer.from(chunk, encoding || 'utf8'))
                                    }
                                }
                                
                                // Decode response body
                                if (responseChunks.length > 0) {
                                    responseBody = decodeResponseBody(responseChunks, contentEncoding)
                                }
                                
                                statusCode = res.statusCode || statusCode
                                
                                // Calculate request duration
                                const duration = Date.now() - startTime
                                const durationStr = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`
                                
                                // Log response
                                const statusEmoji = statusCode >= 200 && statusCode < 300 ? '✓' : statusCode >= 400 ? '✗' : '→'
                                const logType = statusCode >= 200 && statusCode < 300 ? 'success' : statusCode >= 400 ? 'error' : 'info'
                                const responsePreview = responseBody.length > 200 
                                    ? responseBody.substring(0, 200) + '...' 
                                    : responseBody
                                
                                sendLog(
                                    workspaceId, 
                                    `${statusEmoji} ${req.method} ${requestedPath} <- ${statusCode} ${res.statusMessage || ''} [${durationStr}]${responseBody ? ` (${responseBody.length} bytes)` : ''}`,
                                    logType,
                                    mainWindow
                                )
                                
                                // Update API log with completed status
                                sendApiLog(workspaceId, {
                                    method: req.method,
                                    path: requestedPath,
                                    statusCode,
                                    status: statusCode >= 200 && statusCode < 300 ? 'completed' : statusCode >= 400 ? 'error' : 'completed',
                                    statusMessage: res.statusMessage,
                                    targetUrl,
                                    duration,
                                    ipAddress,
                                    userAgent,
                                    apiKey: apiKey ? (apiKey.length > 20 ? apiKey.substring(0, 20) + '...' : apiKey) : undefined,
                                    idempotencyKey,
                                    responseBody: responseBody || undefined,
                                    requestBody: requestBody || undefined,
                                    isBypass: false
                                }, mainWindow, logId, true) // true = update existing entry
                                
                                // Log response body for debugging (truncated if too long)
                                if (responseBody) {
                                    sendLog(
                                        workspaceId,
                                        `Response body: ${responsePreview}`,
                                        logType,
                                        mainWindow
                                    )
                                }
                                
                                return originalEnd(chunk, encoding)
                            }

                            proxy.web(req, res, {
                                target: targetBase,
                                changeOrigin: true,
                                secure: false // Allow self-signed certs
                            })

                        } catch (err: any) {
                            const errorMsg = `Handler error: ${err.message}`
                            sendLog(workspaceId, errorMsg, 'error', mainWindow)
                            console.error(`[Workspace ${workspaceId}] ${errorMsg}`, err)
                            
                            // Update API log for error
                            const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'
                            sendApiLog(workspaceId, {
                                method: req.method,
                                path: requestedPath,
                                statusCode: 500,
                                status: 'error',
                                statusMessage: 'Internal Server Error',
                                error: err.message,
                                ipAddress,
                                isBypass: false
                            }, mainWindow, logId, true) // true = update existing entry
                            
                            res.status(500).json({ error: err.message })
                        }
                    })
                }
            })

            // Handle bypass for any route not handled by enabled endpoints
            if (bypassEnabled && bypassUri) {
                // Create a catch-all middleware that redirects any unmatched route to bypassUri
                app.use((req: Request, res: Response, next: any) => {
                    // Check if this request matches any enabled endpoint
                    const matchesEnabledEndpoint = endpoints.some((ep: any) => {
                        if (ep.enabled === false) return false // Skip disabled endpoints
                        if (ep.method.toUpperCase() !== req.method.toUpperCase()) return false
                        
                        const params = matchPath(ep.path, req.path)
                        return params !== null
                    })

                    // If it doesn't match an enabled endpoint, redirect to bypassUri
                    if (!matchesEnabledEndpoint) {
                        // Capture the original requested path BEFORE modifying req.url
                        // Declare outside try block so it's accessible in catch block
                        const requestedPath = req.path
                        
                        // Generate unique log ID for this request
                        const logId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                        
                        try {
                            const startTime = Date.now()
                            
                            // Use bypassUri as base URL and append the request path
                            // Example: bypassUri = "https://api.app.com/api", req.path = "/posts" 
                            // Result: "https://api.app.com/api/posts"
                            
                            // Ensure bypassUri has protocol
                            let baseUrl = bypassUri.trim()
                            if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
                                baseUrl = 'https://' + baseUrl
                            }
                            
                            // Remove trailing slash from baseUrl if present
                            baseUrl = baseUrl.replace(/\/$/, '')
                            
                            // Get request path (remove leading slash if present, we'll add it)
                            const requestPath = requestedPath.startsWith('/') ? requestedPath : '/' + requestedPath
                            
                            // Build target URL: baseUrl + requestPath + query string
                            const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''
                            const targetUrl = baseUrl + requestPath + queryString

                            // Capture request details
                            const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'
                            const userAgent = req.get('user-agent') || 'unknown'
                            const apiKey = req.get('authorization')?.replace(/^Bearer /, '') || req.get('x-api-key') || undefined
                            const idempotencyKey = req.get('idempotency-key') || req.get('x-idempotency-key') || undefined
                            let requestBody = ''
                            
                            // Capture request body if present
                            if (req.body && typeof req.body === 'object') {
                                requestBody = JSON.stringify(req.body)
                            } else if (typeof req.body === 'string') {
                                requestBody = req.body
                            }

                            // Send initial API log with pending status (create new entry)
                            sendApiLog(workspaceId, {
                                method: req.method,
                                path: requestedPath,
                                status: 'pending',
                                targetUrl,
                                ipAddress,
                                userAgent,
                                apiKey: apiKey ? (apiKey.length > 20 ? apiKey.substring(0, 20) + '...' : apiKey) : undefined,
                                idempotencyKey,
                                requestBody: requestBody || undefined,
                                isBypass: true,
                                timestamp: new Date().toISOString()
                            }, mainWindow, logId, false) // false = create new entry

                            // Send log to renderer
                            sendLog(workspaceId, `${req.method} ${requestedPath} -> ${targetUrl} [BYPASS]`, 'info', mainWindow)

                            // Parse target URL
                            const urlObj = new URL(targetUrl)
                            const targetBase = `${urlObj.protocol}//${urlObj.host}`
                            const targetPath = urlObj.pathname + urlObj.search

                            // Rewrite req.url for the proxy
                            req.url = targetPath

                            // Add response logging for bypass
                            let responseBody = ''
                            let responseChunks: Buffer[] = []
                            let statusCode = res.statusCode || 200
                            let contentEncoding = ''

                            // Helper function to decode response body
                            const decodeResponseBody = (chunks: Buffer[], encoding: string): string => {
                                if (chunks.length === 0) return ''
                                
                                try {
                                    const buffer = Buffer.concat(chunks)
                                    
                                    // http-proxy typically auto-decompresses, but check content-encoding anyway
                                    let dataToDecode: Buffer = buffer
                                    
                                    // Only try decompression if we have an encoding header and data
                                    if (encoding && buffer.length > 0) {
                                        try {
                                            if (encoding === 'gzip') {
                                                dataToDecode = zlib.gunzipSync(buffer)
                                            } else if (encoding === 'deflate') {
                                                dataToDecode = zlib.inflateSync(buffer)
                                            } else if (encoding === 'br') {
                                                dataToDecode = zlib.brotliDecompressSync(buffer)
                                            }
                                        } catch (decompErr) {
                                            // Decompression failed, try with buffer as-is
                                            // (likely already decompressed by http-proxy)
                                        }
                                    }
                                    
                                    // Try UTF-8 decoding
                                    try {
                                        const text = dataToDecode.toString('utf8')
                                        // Basic validation: check if it's mostly printable characters
                                        // Allow some control chars (newlines, tabs, etc.)
                                        const nonPrintableCount = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g) || []).length
                                        const totalLength = text.length
                                        
                                        // If less than 5% non-printable, consider it valid text
                                        if (totalLength === 0 || nonPrintableCount / totalLength < 0.05) {
                                            return text
                                        }
                                    } catch (utf8Err) {
                                        // UTF-8 decode failed, will fall through to binary handling
                                    }
                                    
                                    // If it looks like binary data, check content-type to decide
                                    // For JSON/text responses, force UTF-8 even if it looks binary
                                    // This handles cases where valid UTF-8 might have some control chars
                                    try {
                                        const text = dataToDecode.toString('utf8')
                                        // For JSON, be more lenient
                                        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                                            return text
                                        }
                                    } catch (e) {
                                        // Ignore
                                    }
                                    
                                    // Last resort: return as-is with UTF-8, even if it might look garbled
                                    // This is better than showing base64 for text responses
                                    return dataToDecode.toString('utf8')
                                } catch (err: any) {
                                    return `<unable to decode response body: ${err.message}>`
                                }
                            }

                            // Listen to proxy response event to capture headers
                            const proxyResHandler = (proxyRes: any) => {
                                statusCode = proxyRes.statusCode || 200
                                contentEncoding = (proxyRes.headers['content-encoding'] || res.getHeader('content-encoding') || '').toString().toLowerCase()
                            }

                            proxy.once('proxyRes', proxyResHandler)
                            
                            // Also check response headers as fallback
                            const originalSetHeader = res.setHeader.bind(res)
                            res.setHeader = function(name: string, value: any) {
                                if (name.toLowerCase() === 'content-encoding' && !contentEncoding) {
                                    contentEncoding = value.toString().toLowerCase()
                                }
                                return originalSetHeader(name, value)
                            }

                            // Intercept response data at the proxy level
                            const originalWrite = res.write.bind(res)
                            const originalEnd = res.end.bind(res)

                            res.write = function(chunk: any, encoding?: any) {
                                if (chunk) {
                                    if (Buffer.isBuffer(chunk)) {
                                        responseChunks.push(chunk)
                                    } else {
                                        responseChunks.push(Buffer.from(chunk, encoding || 'utf8'))
                                    }
                                }
                                return originalWrite(chunk, encoding)
                            }

                            res.end = function(chunk?: any, encoding?: any) {
                                if (chunk) {
                                    if (Buffer.isBuffer(chunk)) {
                                        responseChunks.push(chunk)
                                    } else {
                                        responseChunks.push(Buffer.from(chunk, encoding || 'utf8'))
                                    }
                                }
                                
                                // Decode response body
                                if (responseChunks.length > 0) {
                                    responseBody = decodeResponseBody(responseChunks, contentEncoding)
                                }
                                
                                statusCode = res.statusCode || statusCode
                                
                                // Calculate request duration
                                const duration = Date.now() - startTime
                                const durationStr = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`
                                
                                // Log response
                                const statusEmoji = statusCode >= 200 && statusCode < 300 ? '✓' : statusCode >= 400 ? '✗' : '→'
                                const logType = statusCode >= 200 && statusCode < 300 ? 'success' : statusCode >= 400 ? 'error' : 'info'
                                const responsePreview = responseBody.length > 200 
                                    ? responseBody.substring(0, 200) + '...' 
                                    : responseBody
                                
                                sendLog(
                                    workspaceId, 
                                    `${statusEmoji} ${req.method} ${requestedPath} <- ${statusCode} ${res.statusMessage || ''} [${durationStr}] [BYPASS]${responseBody ? ` (${responseBody.length} bytes)` : ''}`,
                                    logType,
                                    mainWindow
                                )
                                
                                // Update API log with completed status
                                sendApiLog(workspaceId, {
                                    method: req.method,
                                    path: requestedPath,
                                    statusCode,
                                    status: statusCode >= 200 && statusCode < 300 ? 'completed' : statusCode >= 400 ? 'error' : 'completed',
                                    statusMessage: res.statusMessage,
                                    targetUrl,
                                    duration,
                                    ipAddress,
                                    userAgent,
                                    apiKey: apiKey ? (apiKey.length > 20 ? apiKey.substring(0, 20) + '...' : apiKey) : undefined,
                                    idempotencyKey,
                                    responseBody: responseBody || undefined,
                                    requestBody: requestBody || undefined,
                                    isBypass: true
                                }, mainWindow, logId, true) // true = update existing entry
                                
                                // Log response body for debugging (truncated if too long)
                                if (responseBody) {
                                    sendLog(
                                        workspaceId,
                                        `Response body: ${responsePreview}`,
                                        logType,
                                        mainWindow
                                    )
                                }
                                
                                return originalEnd(chunk, encoding)
                            }

                            proxy.web(req, res, {
                                target: targetBase,
                                changeOrigin: true,
                                secure: false
                            })
                        } catch (err: any) {
                            const errorMsg = `Bypass error: ${err.message}`
                            sendLog(workspaceId, errorMsg, 'error', mainWindow)
                            console.error(`[Workspace ${workspaceId}] ${errorMsg}`, err)
                            
                            // Update API log for error
                            const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'
                            sendApiLog(workspaceId, {
                                method: req.method,
                                path: requestedPath,
                                statusCode: 500,
                                status: 'error',
                                statusMessage: 'Internal Server Error',
                                error: err.message,
                                ipAddress,
                                isBypass: true
                            }, mainWindow, logId, true) // true = update existing entry
                            
                            res.status(500).json({ error: err.message })
                        }
                    } else {
                        next() // Continue to next handler (shouldn't reach here for enabled endpoints)
                    }
                })
            }

            // Default 404 - only reached if bypass is disabled or bypassUri is not set
            app.use((req: Request, res: Response) => {
                res.status(404).json({ message: 'No route found in gateway config', workspaceId })
            })

            const server = app.listen(port, () => {
                const message = `Proxy server listening on port ${port}`
                sendLog(workspaceId, message, 'success', mainWindow)
                this.servers.set(workspaceId, server)
                resolve()
            })

            server.on('error', (err: Error) => {
                reject(err)
            })
        })
    }

    stopServer(workspaceId: string, mainWindow: BrowserWindow | null = null) {
        return new Promise<void>((resolve) => {
            const server = this.servers.get(workspaceId)
            if (server) {
                server.close(() => {
                    this.servers.delete(workspaceId)
                    sendLog(workspaceId, 'Server stopped', 'info', mainWindow)
                    resolve()
                })
            } else {
                resolve()
            }
        })
    }
}

export const serverManager = new ServerManager()
