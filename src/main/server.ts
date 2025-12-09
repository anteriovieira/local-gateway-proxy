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
                // Replace stageVariables
                for (const [key, val] of Object.entries(variables)) {
                    // key is like "stageVariables.foo"
                    url = url.replace('${' + key + '}', val || '')
                }
                // Replace path params
                for (const [key, val] of Object.entries(params)) {
                    url = url.replace('{' + key + '}', val || '')
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
