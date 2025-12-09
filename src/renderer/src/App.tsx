import React, { useState, useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import { Home } from './components/Layout/Home'
import { WorkspaceView } from './components/Layout/WorkspaceView'
import { TopBar } from './components/Layout/TopBar'
import { SettingsModal } from './components/Layout/SettingsModal'
import { Workspace, EndpointDef } from './types'
import { parseGatewayConfig } from './utils/parser'

// Mock IPC
const ipc = (window as any).electron?.ipcRenderer

function generateId() {
    return Math.random().toString(36).substring(2, 9)
}

const STORAGE_KEY = 'lgp-workspaces'

function loadWorkspacesFromStorage(): Workspace[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            const parsed = JSON.parse(saved) as Workspace[]
            // Reset running state on load (servers aren't running on app start)
            // Ensure integrationProperties and bypassEnabled exist with defaults
            return parsed.map(ws => ({
                ...ws,
                isRunning: false,
                logs: [],
                apiLogs: ws.apiLogs || [],
                integrationProperty: ws.integrationProperty || 'x-amazon-apigateway-integration',
                bypassEnabled: ws.bypassEnabled !== undefined ? ws.bypassEnabled : true, // Default to true
                bypassUri: ws.bypassUri || ''
            }))
        }
    } catch (e) {
        console.error('Failed to load workspaces from localStorage:', e)
    }
    return []
}

function saveWorkspacesToStorage(workspaces: Workspace[]): void {
    try {
        // Don't save logs to storage (they can be large)
        const toSave = workspaces.map(ws => ({ ...ws, logs: [], apiLogs: [] }))
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    } catch (e) {
        console.error('Failed to save workspaces to localStorage:', e)
    }
}

type View = 'home' | 'workspace'

function App() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>(() => loadWorkspacesFromStorage())
    const [activeId, setActiveId] = useState<string | null>(null)
    const [currentView, setCurrentView] = useState<View>('home')
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    // Save to localStorage whenever workspaces change
    useEffect(() => {
        if (workspaces.length > 0) {
            saveWorkspacesToStorage(workspaces)
        }
    }, [workspaces])

    // Set active workspace on initial load and sync server status
    useEffect(() => {
        if (workspaces.length === 0) {
            addNewWorkspace()
        }

        // Sync server status with actual running servers
        const syncServerStatus = async () => {
            if (ipc) {
                try {
                    const runningServers = await ipc.invoke('get-running-servers') as string[]
                    setWorkspaces(prev => prev.map(ws => ({
                        ...ws,
                        isRunning: runningServers.includes(ws.id)
                    })))
                } catch (err) {
                    console.error('Failed to sync server status:', err)
                }
            }
        }

        syncServerStatus()
    }, [])

    // Listen for server logs from main process
    useEffect(() => {
        if (!ipc) return

        const handleServerLog = (data: { workspaceId: string; message: string; type: 'info' | 'error' | 'success'; timestamp: string }) => {
            setWorkspaces(prev => prev.map(ws => {
                if (ws.id !== data.workspaceId) return ws
                return {
                    ...ws,
                    logs: [...ws.logs, { timestamp: data.timestamp, message: data.message, type: data.type }]
                }
            }))
        }

        const handleApiLog = (data: { workspaceId: string; apiLog: any }) => {
            setWorkspaces(prev => prev.map(ws => {
                if (ws.id !== data.workspaceId) return ws
                return {
                    ...ws,
                    apiLogs: [...(ws.apiLogs || []), data.apiLog]
                }
            }))
        }

        const unsubscribeLog = ipc.on('server-log', handleServerLog)
        const unsubscribeApiLog = ipc.on('api-log', handleApiLog)

        return () => {
            if (unsubscribeLog) unsubscribeLog()
            if (unsubscribeApiLog) unsubscribeApiLog()
        }
    }, [])

    const addNewWorkspace = () => {
        const newId = generateId()
        const newWorkspace: Workspace = {
            id: newId,
            name: `Workspace ${workspaces.length + 1}`,
            port: 3000 + workspaces.length,
            configContent: '',
            endpoints: [],
            variables: {},
            isRunning: false,
            logs: [],
            apiLogs: [],
            integrationProperty: 'x-amazon-apigateway-integration',
            bypassEnabled: true // Default to enabled
        }
        setWorkspaces(prev => [...prev, newWorkspace])
        setActiveId(newId)
        setCurrentView('workspace')
    }

    const handleSelectWorkspace = (id: string) => {
        setActiveId(id)
        setCurrentView('workspace')
    }

    const handleGoHome = () => {
        setCurrentView('home')
    }

    const updateWorkspace = (id: string, updates: Partial<Workspace>) => {
        setWorkspaces(prev => prev.map(ws => {
            if (ws.id !== id) return ws

            // Check if configContent or integrationProperty changed, if so parse it
            const shouldReparse = updates.configContent !== undefined && updates.configContent !== ws.configContent
            const integrationPropChanged = updates.integrationProperty !== undefined
            
            if (shouldReparse || integrationPropChanged) {
                try {
                    const integrationProperty = updates.integrationProperty !== undefined 
                        ? updates.integrationProperty 
                        : ws.integrationProperty
                    const configContent = updates.configContent !== undefined 
                        ? updates.configContent 
                        : ws.configContent
                    
                    // Use requestIdleCallback or setTimeout to avoid blocking UI for large files
                    // For now, parse synchronously but optimize the parser itself
                    const parsed = parseGatewayConfig(configContent, integrationProperty)
                    
                    // Convert variables array to Record, preserving existing values
                    const newVariables: Record<string, string> = {}
                    parsed.variables.forEach(v => {
                        newVariables[v] = ws.variables[v] || ''
                    })

                    // Batch endpoint updates to avoid re-rendering issues
                    const newEndpoints = parsed.endpoints.map(e => ({ ...e, enabled: true }))

                    return {
                        ...ws,
                        ...updates,
                        endpoints: newEndpoints,
                        variables: newVariables
                    }
                } catch (e) {
                    // Invalid JSON, just update content
                    return { ...ws, ...updates }
                }
            }

            return { ...ws, ...updates }
        }))
    }

    const toggleServer = async (id: string) => {
        const ws = workspaces.find(w => w.id === id)
        if (!ws) return

        console.log('[DEBUG] toggleServer called', { id, isRunning: ws.isRunning, ipc: !!ipc })

        if (ws.isRunning) {
            // Stop
            console.log('[DEBUG] Stopping server...')
            try {
                await ipc?.invoke('stop-server', { workspaceId: id })
                updateWorkspace(id, { isRunning: false })
                addLog(id, 'Server stopped', 'info')
                toast.success(`Server stopped`, {
                    description: `${ws.name} is no longer running on port ${ws.port}`
                })
            } catch (err: any) {
                toast.error('Failed to stop server', {
                    description: err.message || 'Unknown error occurred'
                })
            }
        } else {
            // Start
            // Filter enabled endpoints
            const activeEndpoints = ws.endpoints.filter(e => e.enabled !== false)
            console.log('[DEBUG] Starting server...', { port: ws.port, endpoints: activeEndpoints.length })

            if (activeEndpoints.length === 0) {
                toast.error('Cannot start server', {
                    description: 'No enabled endpoints available'
                })
                return
            }

            const result = await ipc?.invoke('start-server', {
                workspaceId: id,
                port: ws.port,
                endpoints: ws.endpoints, // Pass all endpoints (enabled and disabled) for bypass support
                variables: ws.variables,
                bypassEnabled: ws.bypassEnabled !== false, // Default to true
                bypassUri: ws.bypassUri || ''
            })

            console.log('[DEBUG] IPC result:', result)

            if (result?.success) {
                updateWorkspace(id, { isRunning: true })
                addLog(id, `Server started on port ${ws.port}`, 'success')
                addLog(id, `Loaded ${activeEndpoints.length} endpoints`, 'info')
                toast.success(`Server started`, {
                    description: `${ws.name} is running on port ${ws.port} with ${activeEndpoints.length} endpoint${activeEndpoints.length !== 1 ? 's' : ''}`
                })
            } else {
                addLog(id, `Failed to start: ${result?.error || 'Unknown error'}`, 'error')
                toast.error('Failed to start server', {
                    description: result?.error || 'Unknown error occurred'
                })
            }
        }
    }

    const addLog = (id: string, message: string, type: 'info' | 'error' | 'success' = 'info') => {
        setWorkspaces(prev => prev.map(ws => {
            if (ws.id !== id) return ws
            return {
                ...ws,
                logs: [...ws.logs, { timestamp: new Date().toLocaleTimeString(), message, type }]
            }
        }))
    }

    const toggleEndpoint = (workspaceId: string, index: number) => {
        setWorkspaces(prev => prev.map(ws => {
            if (ws.id !== workspaceId) return ws
            const newEndpoints = [...ws.endpoints]
            newEndpoints[index] = { ...newEndpoints[index], enabled: !(newEndpoints[index].enabled !== false) }

            return { ...ws, endpoints: newEndpoints }
        }))
    }


    const toggleAllEndpoints = (workspaceId: string, enabled: boolean) => {
        setWorkspaces(prev => prev.map(ws => {
            if (ws.id !== workspaceId) return ws
            const newEndpoints = ws.endpoints.map(ep => ({ ...ep, enabled }))
            return { ...ws, endpoints: newEndpoints }
        }))
    }

    const reorderWorkspaces = (fromIndex: number, toIndex: number) => {
        setWorkspaces(prev => {
            const newWorkspaces = [...prev]
            const [removed] = newWorkspaces.splice(fromIndex, 1)
            newWorkspaces.splice(toIndex, 0, removed)
            return newWorkspaces
        })
    }

    const duplicateWorkspace = (id: string) => {
        const ws = workspaces.find(w => w.id === id)
        if (!ws) return

        const duplicated: Workspace = {
            ...ws,
            id: generateId(),
            name: `${ws.name} (Copy)`,
            isRunning: false,
            logs: [],
            apiLogs: []
        }

        setWorkspaces(prev => [...prev, duplicated])
        toast.success(`Workspace "${ws.name}" duplicated`)
    }

    const removeWorkspace = async (id: string) => {
        const ws = workspaces.find(w => w.id === id)
        if (!ws) return

        // Stop server if running
        if (ws.isRunning && ipc) {
            try {
                await ipc.invoke('stop-server', { workspaceId: id })
            } catch (err) {
                console.error('Failed to stop server before removal:', err)
            }
        }

        // Remove workspace
        setWorkspaces(prev => prev.filter(w => w.id !== id))
        
        // If it was the active workspace, go to home
        if (activeId === id) {
            setActiveId(null)
            setCurrentView('home')
        }

        toast.success(`Workspace "${ws.name}" removed`)
    }

    const clearLogs = (workspaceId: string) => {
        setWorkspaces(prev => prev.map(ws => {
            if (ws.id !== workspaceId) return ws
            return { ...ws, logs: [], apiLogs: [] }
        }))
    }

    const activeWorkspace = workspaces.find(w => w.id === activeId)

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-black text-white font-sans selection:bg-blue-500/30">
            {/* Top Bar */}
            <TopBar 
                workspaces={workspaces}
                activeWorkspaceId={activeId}
                workspaceName={currentView === 'workspace' ? activeWorkspace?.name : undefined}
                workspace={currentView === 'workspace' ? activeWorkspace : null}
                onHome={handleGoHome}
                onSelectWorkspace={handleSelectWorkspace}
                onToggleServer={currentView === 'workspace' && activeWorkspace ? () => toggleServer(activeWorkspace.id) : undefined}
                onUpdateWorkspace={currentView === 'workspace' && activeWorkspace ? (u) => updateWorkspace(activeWorkspace.id, u) : undefined}
                onSettings={() => setIsSettingsOpen(true)}
            />
            
            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
                {currentView === 'home' ? (
                    <Home
                        workspaces={workspaces}
                        activeWorkspaceId={activeId}
                        onSelectWorkspace={handleSelectWorkspace}
                        onAddWorkspace={addNewWorkspace}
                        onReorderWorkspaces={reorderWorkspaces}
                        onRemoveWorkspace={removeWorkspace}
                        onToggleServer={toggleServer}
                        onDuplicateWorkspace={duplicateWorkspace}
                    />
                ) : activeWorkspace ? (
                    <WorkspaceView
                        workspace={activeWorkspace}
                        onUpdate={(u) => updateWorkspace(activeWorkspace.id, u)}
                        onToggleServer={() => toggleServer(activeWorkspace.id)}
                        onEndpointToggle={(idx) => toggleEndpoint(activeWorkspace.id, idx)}
                        onToggleAllEndpoints={(enabled) => toggleAllEndpoints(activeWorkspace.id, enabled)}
                        onClearLogs={() => clearLogs(activeWorkspace.id)}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-zinc-800">
                        Select a workspace
                    </div>
                )}
            </div>

            {/* Settings Modal */}
            <SettingsModal
                workspace={activeWorkspace || null}
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onUpdate={(u) => activeWorkspace && updateWorkspace(activeWorkspace.id, u)}
            />

            {/* Toast Notifications */}
            <Toaster 
                position="bottom-right" 
                theme="dark"
                toastOptions={{
                    className: 'sonner-toast',
                    style: {
                        background: '#18181b',
                        border: '1px solid #27272a',
                        color: '#fafafa',
                    },
                }}
            />
        </div>
    )
}

export default App
