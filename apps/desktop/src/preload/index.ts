// Preload script
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector: string, text: string) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type as keyof NodeJS.ProcessVersions] || '')
    }
})

// Expose IPC
import { contextBridge, ipcRenderer } from 'electron'

try {
    contextBridge.exposeInMainWorld('electron', {
        ipcRenderer: {
            invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
            send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
            on: (channel: string, func: (...args: any[]) => void) => {
                const subscription = (_event: any, ...args: any[]) => func(...args)
                ipcRenderer.on(channel, subscription)
                return () => ipcRenderer.removeListener(channel, subscription)
            }
        }
    })
} catch (error) {
    console.error(error)
    // Fallback for contextIsolation: false if needed, but we should use contextBridge
    if (!(window as any).electron) {
        (window as any).electron = {
            ipcRenderer: ipcRenderer
        }
    }
}
