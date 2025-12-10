import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { systemProxyManager } from './systemProxy'

// Store main window reference for sending messages
let mainWindow: BrowserWindow | null = null

// Suppress macOS menu warning and DevTools Autofill errors
if (process.platform === 'darwin') {
    const originalLog = console.log
    console.log = (...args: any[]) => {
        const message = args.join(' ')
        if (message.includes('representedObject is not a WeakPtrToElectronMenuModelAsNSObject')) {
            return // Suppress this warning
        }
        originalLog(...args)
    }
}

// Suppress DevTools Protocol Autofill errors from stderr
const originalStderrWrite = process.stderr.write.bind(process.stderr)
process.stderr.write = (chunk: any, encoding?: any, callback?: any) => {
    const message = chunk.toString()
    if (
        message.includes("Autofill.enable") ||
        message.includes("Autofill.setAddresses") ||
        (message.includes("wasn't found") && message.includes("Autofill"))
    ) {
        // Suppress these errors
        if (typeof callback === 'function') callback()
        return true
    }
    return originalStderrWrite(chunk, encoding, callback)
}

function createWindow(): void {
    // Get icon path based on platform
    const iconPath = process.platform === 'win32' 
        ? join(__dirname, '../../build/icons/icon-256x256.png')
        : process.platform === 'darwin'
        ? join(__dirname, '../../build/icons/icon-512x512.png')
        : join(__dirname, '../../build/icons/icon-512x512.png')

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 900,
        height: 670,
        show: false,
        autoHideMenuBar: true,
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        frame: process.platform === 'darwin',
        icon: iconPath,
        title: 'Local Gateway Proxy',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            nodeIntegration: false,
            contextIsolation: true // Required for contextBridge to work
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow?.show()
    })

    mainWindow.on('closed', () => {
        mainWindow = null
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })


    // HMR for renderer base on electron-vite. If dev 
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
        mainWindow.loadURL('http://localhost:5173')
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// Export function to send logs to renderer
export function sendLogToRenderer(workspaceId: string, message: string, type: 'info' | 'error' | 'success' = 'info') {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-log', { workspaceId, message, type, timestamp: new Date().toLocaleTimeString() })
    }
}

app.whenReady().then(() => {
    // IPC Handlers
    ipcMain.handle('start-server', async (event, { workspaceId, port, endpoints, variables, bypassEnabled, bypassUri, systemProxyEnabled }) => {
        const { serverManager } = await import('./server')
        try {
            await serverManager.startServer(workspaceId, port, endpoints, variables, bypassEnabled || false, bypassUri || '', systemProxyEnabled || false, mainWindow)
            
            // Configure system proxy if enabled
            if (systemProxyEnabled && process.platform === 'darwin') {
                try {
                    await systemProxyManager.setSystemProxy('localhost', port)
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('server-log', {
                            workspaceId,
                            message: `System proxy configured: localhost:${port}`,
                            type: 'success',
                            timestamp: new Date().toLocaleTimeString()
                        })
                    }
                } catch (proxyErr: any) {
                    console.error('Failed to set system proxy:', proxyErr)
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('server-log', {
                            workspaceId,
                            message: `Warning: Failed to configure system proxy: ${proxyErr.message}`,
                            type: 'error',
                            timestamp: new Date().toLocaleTimeString()
                        })
                    }
                }
            }
            
            return { success: true }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('stop-server', async (event, { workspaceId }) => {
        const { serverManager } = await import('./server')
        await serverManager.stopServer(workspaceId, mainWindow)
        
        // Remove system proxy if it was set by this workspace
        if (process.platform === 'darwin' && systemProxyManager.isProxySetByApp()) {
            try {
                await systemProxyManager.unsetSystemProxy()
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('server-log', {
                        workspaceId,
                        message: 'System proxy removed',
                        type: 'info',
                        timestamp: new Date().toLocaleTimeString()
                    })
                }
            } catch (proxyErr: any) {
                console.error('Failed to remove system proxy:', proxyErr)
            }
        }
        
        return { success: true }
    })

    // Check which servers are running
    ipcMain.handle('get-running-servers', async () => {
        const { serverManager } = await import('./server')
        return serverManager.getRunningServers()
    })

    // System proxy control handlers
    ipcMain.handle('set-system-proxy', async (event, { host, port }) => {
        if (process.platform !== 'darwin') {
            return { success: false, error: 'System proxy is only supported on macOS' }
        }
        try {
            await systemProxyManager.setSystemProxy(host, port)
            return { success: true }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('unset-system-proxy', async () => {
        if (process.platform !== 'darwin') {
            return { success: false, error: 'System proxy is only supported on macOS' }
        }
        try {
            await systemProxyManager.unsetSystemProxy()
            return { success: true }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('get-system-proxy', async () => {
        if (process.platform !== 'darwin') {
            return { success: false, proxy: null }
        }
        try {
            const proxy = await systemProxyManager.getSystemProxy()
            return { success: true, proxy }
        } catch (err: any) {
            return { success: false, error: err.message, proxy: null }
        }
    })

    // Set app user model id for windows
    app.setName('Local Gateway Proxy')

    createWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    // Clean up system proxy before quitting
    if (process.platform === 'darwin' && systemProxyManager.isProxySetByApp()) {
        systemProxyManager.unsetSystemProxy().catch(err => {
            console.error('Failed to clean up system proxy on quit:', err)
        })
    }
    
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// Clean up on app quit
app.on('before-quit', () => {
    if (process.platform === 'darwin' && systemProxyManager.isProxySetByApp()) {
        systemProxyManager.unsetSystemProxy().catch(err => {
            console.error('Failed to clean up system proxy on quit:', err)
        })
    }
})
