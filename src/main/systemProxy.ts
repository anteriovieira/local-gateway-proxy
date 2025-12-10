import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface ProxyConfig {
    host: string
    port: number
    interface: string
}

class SystemProxyManager {
    private currentProxy: ProxyConfig | null = null
    private originalProxy: ProxyConfig | null = null

    /**
     * Detect active network interface (Wi-Fi, Ethernet, etc.)
     */
    private async detectActiveInterface(): Promise<string> {
        try {
            // Get list of network services
            const { stdout } = await execAsync('networksetup -listallnetworkservices')
            const services = stdout
                .split('\n')
                .slice(1) // Skip header
                .map(line => line.trim())
                .filter(line => line.length > 0)

            // Try to find active interface by checking which one has a route
            for (const service of services) {
                try {
                    // Check if this service has proxy settings (indicates it's active)
                    const { stdout: proxyInfo } = await execAsync(
                        `networksetup -getwebproxy "${service}"`
                    )
                    // If we can get proxy info, this interface is likely active
                    // But we'll use the first one that works, or default to Wi-Fi
                    if (proxyInfo && !proxyInfo.includes('Invalid')) {
                        return service
                    }
                } catch {
                    // Continue to next service
                }
            }

            // Default to Wi-Fi if detection fails
            return 'Wi-Fi'
        } catch (error) {
            console.error('Failed to detect network interface:', error)
            return 'Wi-Fi' // Default fallback
        }
    }

    /**
     * Get current system proxy configuration
     */
    async getSystemProxy(): Promise<ProxyConfig | null> {
        try {
            const interfaceName = await this.detectActiveInterface()
            
            // Get HTTP proxy
            const { stdout: httpProxy } = await execAsync(
                `networksetup -getwebproxy "${interfaceName}"`
            )
            
            // Get HTTPS proxy
            const { stdout: httpsProxy } = await execAsync(
                `networksetup -getsecurewebproxy "${interfaceName}"`
            )

            // Parse HTTP proxy
            const httpEnabled = httpProxy.includes('Enabled: Yes')
            const httpMatch = httpProxy.match(/Server: (.+)\nPort: (\d+)/)
            
            // Parse HTTPS proxy
            const httpsEnabled = httpsProxy.includes('Enabled: Yes')
            const httpsMatch = httpsProxy.match(/Server: (.+)\nPort: (\d+)/)

            // Return proxy config if enabled
            if (httpEnabled && httpMatch) {
                return {
                    host: httpMatch[1],
                    port: parseInt(httpMatch[2], 10),
                    interface: interfaceName
                }
            }

            if (httpsEnabled && httpsMatch) {
                return {
                    host: httpsMatch[1],
                    port: parseInt(httpsMatch[2], 10),
                    interface: interfaceName
                }
            }

            return null
        } catch (error) {
            console.error('Failed to get system proxy:', error)
            return null
        }
    }

    /**
     * Save current proxy configuration (to restore later)
     */
    async saveOriginalProxy(): Promise<void> {
        if (!this.originalProxy) {
            this.originalProxy = await this.getSystemProxy()
        }
    }

    /**
     * Execute networksetup command with sudo using osascript
     */
    private async executeWithSudo(command: string): Promise<void> {
        // Escape quotes in command for osascript
        const escapedCommand = command.replace(/"/g, '\\"')
        
        // Use osascript to execute with sudo (will prompt for password)
        const osascriptCommand = `osascript -e 'do shell script "${escapedCommand}" with administrator privileges'`
        
        try {
            await execAsync(osascriptCommand)
        } catch (error: any) {
            // If osascript fails, try direct execution (might work if user has granted permissions)
            try {
                await execAsync(command)
            } catch (directError: any) {
                // Check if it's a permissions error
                const errorMessage = directError.stdout || directError.stderr || directError.message || ''
                const isPermissionError = 
                    directError.code === 14 || 
                    errorMessage.includes('admin privileges') ||
                    errorMessage.includes('requires admin') ||
                    errorMessage.includes('permission denied')
                
                if (isPermissionError) {
                    throw new Error(
                        'Administrator privileges required. ' +
                        'Please grant the app administrator permissions in System Settings > Privacy & Security, ' +
                        'or run the app with administrator privileges.'
                    )
                }
                throw directError
            }
        }
    }

    /**
     * Set system proxy for HTTP and HTTPS
     */
    async setSystemProxy(host: string, port: number): Promise<void> {
        try {
            // Save original proxy before changing
            await this.saveOriginalProxy()

            const interfaceName = await this.detectActiveInterface()

            // Set HTTP proxy with sudo
            await this.executeWithSudo(
                `networksetup -setwebproxy "${interfaceName}" "${host}" ${port}`
            )

            // Set HTTPS proxy with sudo
            await this.executeWithSudo(
                `networksetup -setsecurewebproxy "${interfaceName}" "${host}" ${port}`
            )

            // Enable HTTP proxy with sudo
            await this.executeWithSudo(
                `networksetup -setwebproxystate "${interfaceName}" on`
            )

            // Enable HTTPS proxy with sudo
            await this.executeWithSudo(
                `networksetup -setsecurewebproxystate "${interfaceName}" on`
            )

            this.currentProxy = { host, port, interface: interfaceName }
            
            console.log(`System proxy configured: ${host}:${port} on ${interfaceName}`)
        } catch (error: any) {
            console.error('Failed to set system proxy:', error)
            throw new Error(
                error.message || `Failed to set system proxy: ${error.message || 'Unknown error'}. ` +
                `You may need to grant the app administrator permissions.`
            )
        }
    }

    /**
     * Remove system proxy configuration
     */
    async unsetSystemProxy(): Promise<void> {
        try {
            if (!this.currentProxy) {
                // Try to detect current proxy
                const current = await this.getSystemProxy()
                if (!current) {
                    return // No proxy configured
                }
                this.currentProxy = current
            }

            const interfaceName = this.currentProxy.interface

            // Disable HTTP proxy with sudo
            try {
                await this.executeWithSudo(
                    `networksetup -setwebproxystate "${interfaceName}" off`
                )
            } catch (error: any) {
                // If we can't disable, try without sudo (might work if already has permissions)
                try {
                    await execAsync(
                        `networksetup -setwebproxystate "${interfaceName}" off`
                    )
                } catch {
                    console.warn('Failed to disable HTTP proxy, continuing...')
                }
            }

            // Disable HTTPS proxy with sudo
            try {
                await this.executeWithSudo(
                    `networksetup -setsecurewebproxystate "${interfaceName}" off`
                )
            } catch (error: any) {
                // If we can't disable, try without sudo
                try {
                    await execAsync(
                        `networksetup -setsecurewebproxystate "${interfaceName}" off`
                    )
                } catch {
                    console.warn('Failed to disable HTTPS proxy, continuing...')
                }
            }

            // Restore original proxy if we saved one
            if (this.originalProxy && 
                (this.originalProxy.host !== this.currentProxy.host || 
                 this.originalProxy.port !== this.currentProxy.port)) {
                try {
                    await this.setSystemProxy(
                        this.originalProxy.host,
                        this.originalProxy.port
                    )
                } catch {
                    // If restore fails, just leave proxy disabled
                }
            }

            this.currentProxy = null
            
            console.log(`System proxy removed from ${interfaceName}`)
        } catch (error: any) {
            console.error('Failed to unset system proxy:', error)
            throw new Error(
                error.message || `Failed to remove system proxy: ${error.message || 'Unknown error'}`
            )
        }
    }

    /**
     * Check if system proxy is currently set by this app
     */
    isProxySetByApp(): boolean {
        return this.currentProxy !== null
    }

    /**
     * Get current proxy configuration set by this app
     */
    getCurrentProxy(): ProxyConfig | null {
        return this.currentProxy
    }
}

export const systemProxyManager = new SystemProxyManager()
