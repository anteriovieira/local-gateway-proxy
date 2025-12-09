import { Server } from 'http'
import type { Request, Response, Application } from 'express'
import type { BrowserWindow } from 'electron'

// Use require for CommonJS compatibility with Electron main process
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const httpProxy = require('http-proxy')

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
            app.use(bodyParser.json()) // Keep for now as we might need it, but be aware of proxy stream issues if modifying body

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
                        try {
                            const startTime = Date.now()
                            const targetUrl = resolveUrl(ep.uriTemplate, req.params as Record<string, string>)

                            // Send log to renderer
                            sendLog(workspaceId, `${req.method} ${req.path} -> ${targetUrl}`, 'info', mainWindow)

                            // We need to parse target to get base for http-proxy
                            // Note: if targetUrl is invalid, this throws
                            const urlObj = new URL(targetUrl)
                            const targetBase = `${urlObj.protocol}//${urlObj.host}`
                            const targetPath = urlObj.pathname + urlObj.search

                            // Rewrite req.url for the proxy
                            req.url = targetPath

                            // Add response logging
                            const originalWrite = res.write.bind(res)
                            const originalEnd = res.end.bind(res)
                            let responseBody = ''
                            let statusCode = res.statusCode || 200

                            // Intercept response data
                            res.write = function(chunk: any, encoding?: any) {
                                if (chunk) {
                                    responseBody += chunk.toString()
                                }
                                return originalWrite(chunk, encoding)
                            }

                            res.end = function(chunk?: any, encoding?: any) {
                                if (chunk) {
                                    responseBody += chunk.toString()
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
                                    `${statusEmoji} ${req.method} ${req.path} <- ${statusCode} ${res.statusMessage || ''} [${durationStr}]${responseBody ? ` (${responseBody.length} bytes)` : ''}`,
                                    logType,
                                    mainWindow
                                )
                                
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

                            // Listen to proxy response event
                            const proxyResHandler = (proxyRes: any) => {
                                statusCode = proxyRes.statusCode || 200
                                // Status code will be logged in res.end handler
                            }

                            proxy.once('proxyRes', proxyResHandler)

                            proxy.web(req, res, {
                                target: targetBase,
                                changeOrigin: true,
                                secure: false // Allow self-signed certs
                            })

                        } catch (err: any) {
                            const errorMsg = `Handler error: ${err.message}`
                            sendLog(workspaceId, errorMsg, 'error', mainWindow)
                            console.error(`[Workspace ${workspaceId}] ${errorMsg}`, err)
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
                            const requestPath = req.path.startsWith('/') ? req.path : '/' + req.path
                            
                            // Build target URL: baseUrl + requestPath + query string
                            const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''
                            const targetUrl = baseUrl + requestPath + queryString

                            // Send log to renderer
                            sendLog(workspaceId, `${req.method} ${req.path} -> ${targetUrl} [BYPASS]`, 'info', mainWindow)

                            // Parse target URL
                            const urlObj = new URL(targetUrl)
                            const targetBase = `${urlObj.protocol}//${urlObj.host}`
                            const targetPath = urlObj.pathname + urlObj.search

                            // Rewrite req.url for the proxy
                            req.url = targetPath

                            // Add response logging for bypass
                            const originalWrite = res.write.bind(res)
                            const originalEnd = res.end.bind(res)
                            let responseBody = ''
                            let statusCode = res.statusCode || 200

                            // Intercept response data
                            res.write = function(chunk: any, encoding?: any) {
                                if (chunk) {
                                    responseBody += chunk.toString()
                                }
                                return originalWrite(chunk, encoding)
                            }

                            res.end = function(chunk?: any, encoding?: any) {
                                if (chunk) {
                                    responseBody += chunk.toString()
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
                                    `${statusEmoji} ${req.method} ${req.path} <- ${statusCode} ${res.statusMessage || ''} [${durationStr}] [BYPASS]${responseBody ? ` (${responseBody.length} bytes)` : ''}`,
                                    logType,
                                    mainWindow
                                )
                                
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

                            // Listen to proxy response event
                            const proxyResHandler = (proxyRes: any) => {
                                statusCode = proxyRes.statusCode || 200
                            }

                            proxy.once('proxyRes', proxyResHandler)

                            proxy.web(req, res, {
                                target: targetBase,
                                changeOrigin: true,
                                secure: false
                            })
                        } catch (err: any) {
                            const errorMsg = `Bypass error: ${err.message}`
                            sendLog(workspaceId, errorMsg, 'error', mainWindow)
                            console.error(`[Workspace ${workspaceId}] ${errorMsg}`, err)
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
