import React, { useState, useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import { Home } from './components/Layout/Home'
import { WorkspaceView } from './components/Layout/WorkspaceView'
import { TopBar } from './components/Layout/TopBar'
import { Footer } from './components/Layout/Footer'
import { SettingsPage } from './components/Layout/SettingsModal'
import { TerminalPage } from './components/Switchboard/TerminalLogModal'
import { MockPanel } from './components/Switchboard/MockPanel'
import { MockDbPanel } from './components/Switchboard/MockDbPanel'
import { Terminal, Layers, Sliders, History, Settings, Play, Square, RotateCw, Server, Database, ChevronsUpDown, Plus, Check } from 'lucide-react'
import { cn, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@proxy-app/ui'
import type { Workspace } from './types'
import { parseGatewayConfig } from '@proxy-app/shared'
import { useProxyAdapter } from './ProxyContext'

type ExtensionNavTab = 'workspaces' | 'definitions' | 'requests' | 'database' | 'mocks' | 'settings' | 'terminal'

const STORAGE_KEY = 'lgp-workspaces'

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

function loadWorkspacesFromStorage(): Workspace[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Workspace[]
      return parsed.map((ws) => ({
        ...ws,
        isRunning: false,
        logs: [],
        apiLogs: ws.apiLogs || [],
        integrationProperty: ws.integrationProperty || 'x-amazon-apigateway-integration',
        bypassEnabled: ws.bypassEnabled !== undefined ? ws.bypassEnabled : true,
        bypassUri: ws.bypassUri || '',
        captureResourceTypes: ws.captureResourceTypes ?? ['xmlhttprequest'],
      }))
    }
  } catch (e) {
    console.error('Failed to load workspaces from localStorage:', e)
  }
  return []
}

function saveWorkspacesToStorage(workspaces: Workspace[]): void {
  try {
    const toSave = workspaces.map((ws) => ({ ...ws, logs: [], apiLogs: [] }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (e) {
    console.error('Failed to save workspaces to localStorage:', e)
  }
}

type View = 'home' | 'workspace' | 'settings' | 'terminal'

export function App({ nativeWindowDrag = false, variant = 'desktop' }: { nativeWindowDrag?: boolean; variant?: 'desktop' | 'extension' }) {
  const adapter = useProxyAdapter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => loadWorkspacesFromStorage())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<View>('home')
  const [previousView, setPreviousView] = useState<View>('home')
  const [isEndpointsPanelOpen, setIsEndpointsPanelOpen] = useState(false)
  const [extensionNavTab, setExtensionNavTab] = useState<ExtensionNavTab>('requests')

  useEffect(() => {
    if (workspaces.length > 0) saveWorkspacesToStorage(workspaces)
  }, [workspaces])

  useEffect(() => {
    if (workspaces.length === 0) addNewWorkspace()
    const syncServerStatus = async () => {
      try {
        const runningServers = await adapter.getRunningServers()
        setWorkspaces((prev) =>
          prev.map((ws) => ({
            ...ws,
            isRunning: runningServers.includes(ws.id),
          }))
        )
      } catch (err) {
        console.error('Failed to sync server status:', err)
      }
    }
    syncServerStatus()
  }, [])

  useEffect(() => {
    const unsubLog = adapter.onServerLog((data) => {
      setWorkspaces((prev) =>
        prev.map((ws) => {
          if (ws.id !== data.workspaceId) return ws
          return { ...ws, logs: [...ws.logs, { timestamp: data.timestamp, message: data.message, type: data.type }] }
        })
      )
    })
    const unsubApiLog = adapter.onApiLog((data) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d3449e43-fac1-4b3c-bcd4-c3d1cad8abb2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bfb319'},body:JSON.stringify({sessionId:'bfb319',location:'App.tsx:onApiLog',message:'api-log received',data:{workspaceId:data.workspaceId,isUpdate:data.isUpdate,logId:data.apiLog?.id,responseBodyLen:data.apiLog?.responseBody?.length??0,hasResponseBody:!!data.apiLog?.responseBody},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      setWorkspaces((prev) =>
        prev.map((ws) => {
          if (ws.id !== data.workspaceId) return ws
          if (data.isUpdate && data.apiLog.id) {
            const existingIndex = ws.apiLogs.findIndex((log) => log.id === data.apiLog.id)
            if (existingIndex >= 0) {
              const updatedLogs = [...ws.apiLogs]
              const existingLog = updatedLogs[existingIndex]
              updatedLogs[existingIndex] = { ...existingLog, ...data.apiLog, timestamp: data.apiLog.timestamp || existingLog.timestamp }
              return { ...ws, apiLogs: updatedLogs }
            }
          }
          return { ...ws, apiLogs: [...(ws.apiLogs || []), data.apiLog] }
        })
      )
    })
    const unsubMockDb = adapter.onMockDbUpdate?.((snapshot) => {
      const newInitialData = JSON.stringify(snapshot, null, 2)
      setWorkspaces((prev) =>
        prev.map((ws) => {
          if (!ws.isRunning || !ws.mockDbConfig) return ws
          return { ...ws, mockDbConfig: { ...ws.mockDbConfig, initialData: newInitialData } }
        })
      )
    })
    return () => {
      unsubLog()
      unsubApiLog()
      unsubMockDb?.()
    }
  }, [adapter])

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
      bypassEnabled: true,
      captureResourceTypes: ['xmlhttprequest'],
    }
    setWorkspaces((prev) => [...prev, newWorkspace])
    setActiveId(newId)
    setCurrentView('workspace')
  }

  const handleSelectWorkspace = (id: string) => {
    setActiveId(id)
    setCurrentView('workspace')
    if (variant === 'extension') setExtensionNavTab('requests')
  }

  const handleGoHome = () => {
    setCurrentView('home')
  }

  const navigateTo = (view: View) => {
    setPreviousView(currentView)
    setCurrentView(view)
  }

  const goBack = () => {
    setCurrentView(previousView)
  }

  const updateWorkspace = (id: string, updates: Partial<Workspace>) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== id) return ws
        const shouldReparse = updates.configContent !== undefined && updates.configContent !== ws.configContent
        const integrationPropChanged = updates.integrationProperty !== undefined
        if (shouldReparse || integrationPropChanged) {
          try {
            const integrationProperty = updates.integrationProperty ?? ws.integrationProperty
            const configContent = updates.configContent ?? ws.configContent
            const parsed = parseGatewayConfig(configContent, integrationProperty)
            const newVariables: Record<string, string> = {}
            parsed.variables.forEach((v) => {
              newVariables[v] = ws.variables[v] || ''
            })
            const newEndpoints = parsed.endpoints.map((e) => ({ ...e, enabled: true }))
            return { ...ws, ...updates, endpoints: newEndpoints, variables: newVariables }
          } catch {
            return { ...ws, ...updates }
          }
        }
        return { ...ws, ...updates }
      })
    )

    // Sync endpoints to background proxy state if workspace is running
    if (updates.endpoints && adapter.updateEndpoints) {
      const ws = workspaces.find((w) => w.id === id)
      if (ws?.isRunning) {
        adapter.updateEndpoints(updates.endpoints)
      }
    }

    // Sync URL filter to background proxy state if workspace is running
    if (updates.urlMustContain !== undefined && adapter.updateUrlFilter) {
      const ws = workspaces.find((w) => w.id === id)
      if (ws?.isRunning) {
        adapter.updateUrlFilter(updates.urlMustContain)
      }
    }

    // Sync mock database config to background if workspace is running
    if (updates.mockDbConfig !== undefined && adapter.updateMockDb) {
      const ws = workspaces.find((w) => w.id === id)
      if (ws?.isRunning) {
        if (updates.mockDbConfig?.initialData) {
          adapter.updateMockDb(updates.mockDbConfig.initialData)
        } else {
          // Mock DB was disabled — destroy it in background
          adapter.updateMockDb('')
        }
      }
    }
  }

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
    if (m > 0) return `${m}m ${s % 60}s`
    return `${s}s`
  }

  const toggleServer = async (id: string) => {
    const ws = workspaces.find((w) => w.id === id)
    if (!ws) return

    if (ws.isRunning) {
      try {
        const startedAt = ws.startedAt ? new Date(ws.startedAt).getTime() : null
        const durationMs = startedAt ? Date.now() - startedAt : 0
        await adapter.stopServer(id)
        const durationLog =
          durationMs > 0
            ? { timestamp: new Date().toLocaleTimeString(), message: `Session duration: ${formatDuration(durationMs)}`, type: 'info' as const }
            : null
        setWorkspaces((prev) =>
          prev.map((w) => {
            if (w.id !== id) return w
            return {
              ...w,
              isRunning: false,
              startedAt: undefined,
              logs: durationLog ? [...w.logs, durationLog] : w.logs,
            }
          })
        )
        toast.success(`Server stopped`, {
          description: variant === 'extension' ? `${ws.name} is no longer capturing requests` : `${ws.name} is no longer running on port ${ws.port}`,
        })
      } catch (err: unknown) {
        toast.error('Failed to stop server', { description: err instanceof Error ? err.message : 'Unknown error occurred' })
      }
    } else {
      const activeEndpoints = ws.endpoints.filter((e) => e.enabled !== false)
      if (variant === 'desktop' && activeEndpoints.length === 0) {
        toast.error('Cannot start server', {
          description: 'No enabled endpoints available',
        })
        return
      }
      const result = await adapter.startServer({
        workspaceId: id,
        port: ws.port,
        endpoints: ws.endpoints,
        variables: ws.variables,
        bypassEnabled: ws.bypassEnabled !== false,
        bypassUri: ws.bypassUri || '',
        captureResourceTypes: ws.captureResourceTypes ?? ['xmlhttprequest'],
        urlMustContain: ws.urlMustContain,
        mockDbConfig: ws.mockDbConfig,
      })
      if (result?.success) {
        updateWorkspace(id, { isRunning: true, startedAt: new Date().toISOString() })
        toast.success(variant === 'extension' ? 'Recording started' : 'Server started', {
          description:
            variant === 'extension'
              ? activeEndpoints.length > 0
                ? `${ws.name} is capturing requests (${activeEndpoints.length} endpoint${activeEndpoints.length !== 1 ? 's' : ''})`
                : `${ws.name} is capturing requests`
              : `${ws.name} is running on port ${ws.port} with ${activeEndpoints.length} endpoint${activeEndpoints.length !== 1 ? 's' : ''}`,
        })
      } else {
        toast.error('Failed to start server', { description: result?.error || 'Unknown error occurred' })
      }
    }
  }

  const restartServer = async (id: string) => {
    const ws = workspaces.find((w) => w.id === id)
    if (!ws) return
    if (!ws.isRunning) {
      await toggleServer(id)
      return
    }
    try {
      const startedAt = ws.startedAt ? new Date(ws.startedAt).getTime() : null
      const durationMs = startedAt ? Date.now() - startedAt : 0
      await adapter.stopServer(id)
      const durationLog =
        durationMs > 0
          ? { timestamp: new Date().toLocaleTimeString(), message: `Session duration: ${formatDuration(durationMs)}`, type: 'info' as const }
          : null
      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.id !== id) return w
          return {
            ...w,
            isRunning: false,
            startedAt: undefined,
            logs: durationLog ? [...w.logs, durationLog] : w.logs,
          }
        })
      )
      await new Promise((resolve) => setTimeout(resolve, 500))
      const activeEndpoints = ws.endpoints.filter((e) => e.enabled !== false)
      if (variant === 'desktop' && activeEndpoints.length === 0) {
        toast.error('Cannot restart server', {
          description: 'No enabled endpoints available',
        })
        return
      }
      const result = await adapter.startServer({
        workspaceId: id,
        port: ws.port,
        endpoints: ws.endpoints,
        variables: ws.variables,
        bypassEnabled: ws.bypassEnabled !== false,
        bypassUri: ws.bypassUri || '',
        captureResourceTypes: ws.captureResourceTypes ?? ['xmlhttprequest'],
        urlMustContain: ws.urlMustContain,
        mockDbConfig: ws.mockDbConfig,
      })
      if (result?.success) {
        updateWorkspace(id, { isRunning: true, startedAt: new Date().toISOString() })
        toast.success(variant === 'extension' ? 'Recording restarted' : 'Server restarted', {
          description:
            variant === 'extension'
              ? activeEndpoints.length > 0
                ? `${ws.name} is capturing requests (${activeEndpoints.length} endpoint${activeEndpoints.length !== 1 ? 's' : ''})`
                : `${ws.name} is capturing requests`
              : `${ws.name} has been restarted on port ${ws.port} with ${activeEndpoints.length} endpoint${activeEndpoints.length !== 1 ? 's' : ''}`,
        })
      } else {
        toast.error('Failed to restart server', { description: result?.error || 'Unknown error occurred' })
      }
    } catch (err: unknown) {
      toast.error('Failed to restart server', { description: err instanceof Error ? err.message : 'Unknown error occurred' })
    }
  }

  const duplicateWorkspace = (id: string) => {
    const ws = workspaces.find((w) => w.id === id)
    if (!ws) return
    const duplicated: Workspace = {
      ...ws,
      id: generateId(),
      name: `${ws.name} (Copy)`,
      isRunning: false,
      logs: [],
      apiLogs: [],
    }
    setWorkspaces((prev) => [...prev, duplicated])
    toast.success(`Workspace "${ws.name}" duplicated`)
  }

  const removeWorkspace = async (id: string) => {
    const ws = workspaces.find((w) => w.id === id)
    if (!ws) return
    if (ws.isRunning) {
      try {
        await adapter.stopServer(id)
      } catch (err) {
        console.error('Failed to stop server before removal:', err)
      }
    }
    setWorkspaces((prev) => prev.filter((w) => w.id !== id))
    if (activeId === id) {
      setActiveId(null)
      setCurrentView('home')
    }
    toast.success(`Workspace "${ws.name}" removed`)
  }

  const clearLogs = (workspaceId: string) => {
    setWorkspaces((prev) =>
      prev.map((ws) => (ws.id !== workspaceId ? ws : { ...ws, logs: [], apiLogs: [] }))
    )
  }

  const toggleEndpoint = (workspaceId: string, index: number) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws
        const newEndpoints = [...ws.endpoints]
        newEndpoints[index] = { ...newEndpoints[index], enabled: !(newEndpoints[index].enabled !== false) }
        return { ...ws, endpoints: newEndpoints }
      })
    )
  }

  const toggleAllEndpoints = (workspaceId: string, enabled: boolean) => {
    setWorkspaces((prev) =>
      prev.map((ws) => (ws.id !== workspaceId ? ws : { ...ws, endpoints: ws.endpoints.map((ep) => ({ ...ep, enabled })) }))
    )
  }

  const reorderWorkspaces = (fromIndex: number, toIndex: number) => {
    setWorkspaces((prev) => {
      const newWorkspaces = [...prev]
      const [removed] = newWorkspaces.splice(fromIndex, 1)
      newWorkspaces.splice(toIndex, 0, removed)
      return newWorkspaces
    })
  }

  useEffect(() => {
    if (variant === 'extension' && !activeId && workspaces.length > 0) {
      setActiveId(workspaces[0].id)
    }
  }, [workspaces, activeId, variant])

  const activeWorkspace = workspaces.find((w) => w.id === activeId)

  const terminalLogs =
    currentView === 'workspace' && activeWorkspace
      ? activeWorkspace.logs
      : workspaces.flatMap((w) => w.logs)

  const footerActions = [
    {
      id: 'terminal',
      label: 'Terminal',
      icon: <Terminal className="w-3.5 h-3.5" />,
      onClick: () => navigateTo('terminal'),
      active: currentView === 'terminal',
    },
  ]

  if (variant === 'extension') {
    const navItems: Array<{ tab: ExtensionNavTab; icon: React.ReactNode; label: string }> = [
      { tab: 'workspaces', icon: <Layers className="w-4 h-4" />, label: 'Workspaces' },
      { tab: 'definitions', icon: <Sliders className="w-4 h-4" />, label: 'Definitions' },
      { tab: 'requests', icon: <History className="w-4 h-4" />, label: 'History' },
      { tab: 'database', icon: <Database className="w-4 h-4" />, label: 'Database' },
      { tab: 'mocks', icon: <Server className="w-4 h-4" />, label: 'Mocks' },
    ]

    return (
      <div className="flex flex-1 min-h-0 h-screen w-screen overflow-hidden bg-zinc-900 text-white font-sans selection:bg-blue-500/30">
        {/* Icon sidebar */}
        <nav className="flex flex-col items-center py-2 bg-zinc-900 shrink-0" style={{ width: 48 }}>
          <div className="flex flex-col items-center gap-1 w-full px-1.5">
            {navItems.map(({ tab, icon, label }) => (
              <button
                key={tab}
                title={label}
                onClick={() => setExtensionNavTab(tab)}
                className={cn(
                  'w-full flex items-center justify-center p-2.5 rounded-md transition-colors',
                  extensionNavTab === tab
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                )}
              >
                {icon}
              </button>
            ))}
          </div>
          <div className="mt-auto px-1.5 w-full flex flex-col gap-1">
            <button
              title="Terminal"
              onClick={() => setExtensionNavTab('terminal')}
              className={cn(
                'w-full flex items-center justify-center p-2.5 rounded-md transition-colors',
                extensionNavTab === 'terminal'
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              )}
            >
              <Terminal className="w-4 h-4" />
            </button>
            <button
              title="Settings"
              onClick={() => setExtensionNavTab('settings')}
              className={cn(
                'w-full flex items-center justify-center p-2.5 rounded-md transition-colors',
                extensionNavTab === 'settings'
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              )}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </nav>

        {/* Content area */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          {/* Header - outside the rounded container */}
          <div className="h-10 flex items-center justify-between px-3 bg-zinc-900 shrink-0">
            <div className="flex items-center gap-1.5 text-sm min-w-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-zinc-800 transition-colors text-xs font-medium text-zinc-300 min-w-0">
                    <span className="truncate max-w-[140px]">{activeWorkspace?.name ?? 'Workspaces'}</span>
                    <ChevronsUpDown className="w-3 h-3 text-zinc-500 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {workspaces.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-zinc-500 text-center">No workspaces</div>
                  ) : (
                    workspaces.map((ws) => (
                      <DropdownMenuItem
                        key={ws.id}
                        onClick={() => { setActiveId(ws.id); setExtensionNavTab('requests') }}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{ws.name}</div>
                          <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                            <div className="flex items-center gap-1">
                              <div className={cn("h-1.5 w-1.5 rounded-full", ws.isRunning ? "bg-emerald-500" : "bg-zinc-700")} />
                              <span>{ws.isRunning ? "Running" : "Stopped"}</span>
                            </div>
                          </div>
                        </div>
                        {activeId === ws.id && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                      </DropdownMenuItem>
                    ))
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={addNewWorkspace} className="text-zinc-300">
                    <Plus className="w-4 h-4 text-zinc-400" />
                    <span className="font-medium">New Workspace</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {activeWorkspace && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => !activeWorkspace.isRunning && toggleServer(activeWorkspace.id)}
                  disabled={activeWorkspace.isRunning}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    activeWorkspace.isRunning
                      ? "text-zinc-600 cursor-default"
                      : "text-emerald-400 hover:bg-zinc-800 hover:text-emerald-300"
                  )}
                  title="Start"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => activeWorkspace.isRunning && toggleServer(activeWorkspace.id)}
                  disabled={!activeWorkspace.isRunning}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    activeWorkspace.isRunning
                      ? "text-red-400 hover:bg-zinc-800 hover:text-red-300"
                      : "text-zinc-600 cursor-default"
                  )}
                  title="Stop"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => restartServer(activeWorkspace.id)}
                  disabled={!activeWorkspace.isRunning}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    activeWorkspace.isRunning
                      ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      : "text-zinc-600 cursor-default"
                  )}
                  title="Restart"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Page content - rounded container */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-zinc-950 rounded-xl border border-zinc-800 mr-2 mb-2">
            {extensionNavTab === 'settings' ? (
              <SettingsPage
                workspace={activeWorkspace || null}
                onBack={() => setExtensionNavTab('requests')}
                onUpdate={(u) => activeWorkspace && updateWorkspace(activeWorkspace.id, u)}
                variant={variant}
              />
            ) : extensionNavTab === 'terminal' ? (
              <TerminalPage
                onBack={() => setExtensionNavTab('requests')}
                logs={terminalLogs}
              />
            ) : extensionNavTab === 'workspaces' ? (
              <Home
                workspaces={workspaces}
                activeWorkspaceId={activeId}
                onSelectWorkspace={handleSelectWorkspace}
                onAddWorkspace={addNewWorkspace}
                onReorderWorkspaces={reorderWorkspaces}
                onRemoveWorkspace={removeWorkspace}
                onToggleServer={toggleServer}
                onDuplicateWorkspace={duplicateWorkspace}
                variant={variant}
              />
            ) : extensionNavTab === 'database' && activeWorkspace ? (
              <MockDbPanel
                workspace={activeWorkspace}
                onUpdate={(u) => updateWorkspace(activeWorkspace.id, u)}
              />
            ) : extensionNavTab === 'mocks' && activeWorkspace ? (
              <MockPanel
                workspace={activeWorkspace}
                onUpdate={(u) => updateWorkspace(activeWorkspace.id, u)}
              />
            ) : activeWorkspace ? (
              <WorkspaceView
                workspace={activeWorkspace}
                onUpdate={(u) => updateWorkspace(activeWorkspace.id, u)}
                onToggleServer={() => toggleServer(activeWorkspace.id)}
                onRestartServer={() => restartServer(activeWorkspace.id)}
                onEndpointToggle={(idx) => toggleEndpoint(activeWorkspace.id, idx)}
                onToggleAllEndpoints={(enabled) => toggleAllEndpoints(activeWorkspace.id, enabled)}
                onClearLogs={() => clearLogs(activeWorkspace.id)}
                variant="extension"
                isEndpointsPanelOpen={extensionNavTab === 'definitions'}
                onCloseEndpointsPanel={() => setExtensionNavTab('requests')}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
                Select a workspace
              </div>
            )}
          </div>
        </div>

        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            className: 'sonner-toast',
            style: { background: '#18181b', border: '1px solid #27272a', color: '#fafafa' },
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 h-screen w-screen overflow-hidden bg-zinc-900 text-white font-sans selection:bg-blue-500/30">
      <TopBar
        workspaces={workspaces}
        activeWorkspaceId={activeId}
        workspaceName={currentView === 'workspace' ? activeWorkspace?.name : undefined}
        workspace={currentView === 'workspace' ? activeWorkspace : null}
        onHome={handleGoHome}
        onSelectWorkspace={handleSelectWorkspace}
        onToggleServer={currentView === 'workspace' && activeWorkspace ? () => toggleServer(activeWorkspace.id) : undefined}
        onRestartServer={currentView === 'workspace' && activeWorkspace ? () => restartServer(activeWorkspace.id) : undefined}
        onUpdateWorkspace={currentView === 'workspace' && activeWorkspace ? (u) => updateWorkspace(activeWorkspace.id, u) : undefined}
        onSettings={() => navigateTo('settings')}
        onAddWorkspace={addNewWorkspace}
        nativeWindowDrag={nativeWindowDrag}
        variant={variant}
        onOpenEndpoints={variant === 'extension' ? () => setIsEndpointsPanelOpen(true) : undefined}
      />
      <div
        className="flex flex-col overflow-hidden w-full flex-1 min-h-0 mr-2 mb-2 rounded-xl bg-zinc-950 border border-zinc-800"
        style={{ flex: '1 1 0', minHeight: 0 }}
      >
        {currentView === 'settings' ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden w-full">
            <SettingsPage
              workspace={activeWorkspace || null}
              onBack={goBack}
              onUpdate={(u) => activeWorkspace && updateWorkspace(activeWorkspace.id, u)}
              variant={variant}
            />
          </div>
        ) : currentView === 'terminal' ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden w-full">
            <TerminalPage
              onBack={goBack}
              logs={terminalLogs}
            />
          </div>
        ) : currentView === 'home' ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden w-full">
          <Home
            workspaces={workspaces}
            activeWorkspaceId={activeId}
            onSelectWorkspace={handleSelectWorkspace}
            onAddWorkspace={addNewWorkspace}
            onReorderWorkspaces={reorderWorkspaces}
            onRemoveWorkspace={removeWorkspace}
            onToggleServer={toggleServer}
            onDuplicateWorkspace={duplicateWorkspace}
            variant={variant}
          />
          </div>
        ) : activeWorkspace ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden w-full">
          <WorkspaceView
            workspace={activeWorkspace}
            onUpdate={(u) => updateWorkspace(activeWorkspace.id, u)}
            onToggleServer={() => toggleServer(activeWorkspace.id)}
            onRestartServer={() => restartServer(activeWorkspace.id)}
            onEndpointToggle={(idx) => toggleEndpoint(activeWorkspace.id, idx)}
            onToggleAllEndpoints={(enabled) => toggleAllEndpoints(activeWorkspace.id, enabled)}
            onClearLogs={() => clearLogs(activeWorkspace.id)}
            variant={variant}
            isEndpointsPanelOpen={isEndpointsPanelOpen}
            onCloseEndpointsPanel={() => setIsEndpointsPanelOpen(false)}
          />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-800">Select a workspace</div>
        )}
      </div>
      <Footer actions={footerActions} variant={variant} />
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          className: 'sonner-toast',
          style: { background: '#18181b', border: '1px solid #27272a', color: '#fafafa' },
        }}
      />
    </div>
  )
}
