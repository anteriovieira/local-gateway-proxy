import React, { useState, useEffect, useRef } from 'react'
import { Toaster, toast } from 'sonner'
import { Home } from './components/Layout/Home'
import { WorkspaceView } from './components/Layout/WorkspaceView'
import { PanelWrapper } from './components/Layout/PanelWrapper'
import { SettingsPage } from './components/Layout/SettingsModal'
import { TerminalPage } from './components/Switchboard/TerminalLogModal'
import { MockPanel } from './components/Switchboard/MockPanel'
import { MockDbPanel } from './components/Switchboard/MockDbPanel'
import { DefinitionsModal } from './components/Switchboard/DefinitionsModal'
import { Terminal, Layers, Sliders, History, Settings, Play, Square, RotateCw, Server, Database, ChevronsUpDown, Plus, Check } from 'lucide-react'
import { cn, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@proxy-app/ui'
import type { Workspace } from './types'
import { parseGatewayConfig } from '@proxy-app/shared'
import { useProxyAdapter } from './ProxyContext'

type NavTab = 'workspaces' | 'definitions' | 'requests' | 'database' | 'mocks' | 'settings'
type PanelId = 'workspaces' | 'definitions' | 'database' | 'mocks' | 'settings'
type PanelPosition = 'left' | 'right'

const PANEL_POSITIONS: Record<PanelId, PanelPosition> = {
  workspaces: 'left',
  definitions: 'left',
  database: 'right',
  mocks: 'right',
  settings: 'right',
}

const PANEL_TITLES: Record<PanelId, string> = {
  workspaces: 'Workspaces',
  definitions: 'Definitions',
  database: 'Database',
  mocks: 'Mocks',
  settings: 'Settings',
}

const COMPACT_BREAKPOINT = 640

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

type View = 'home' | 'workspace' | 'settings'

export function App({ nativeWindowDrag = false, variant = 'desktop' }: { nativeWindowDrag?: boolean; variant?: 'desktop' | 'extension' }) {
  const adapter = useProxyAdapter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => loadWorkspacesFromStorage())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<View>('home')
  const [isTerminalOpen, setIsTerminalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<NavTab>('requests')

  // Panel system (wide mode)
  const [activePanels, setActivePanels] = useState<Partial<Record<PanelPosition, PanelId>>>({})

  // Responsive: compact vs wide mode
  const [isCompact, setIsCompact] = useState(variant === 'extension')
  const contentRef = useRef<HTMLDivElement>(null)

  // Elapsed timer
  const [elapsedMs, setElapsedMs] = useState(0)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (workspaces.length > 0) saveWorkspacesToStorage(workspaces)
  }, [workspaces])

  // Sync badge count for extension
  useEffect(() => {
    if (variant === 'extension' && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      const runningCount = workspaces.filter((ws) => ws.isRunning).length
      chrome.runtime.sendMessage({ type: 'update-badge', payload: { count: runningCount } }).catch(() => {})
    }
  }, [workspaces, variant])

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
      const collections = Object.keys(snapshot)
      const totalItems = collections.reduce((sum, k) => sum + (Array.isArray(snapshot[k]) ? (snapshot[k] as unknown[]).length : 0), 0)
      setWorkspaces((prev) =>
        prev.map((ws) => {
          if (!ws.isRunning || !ws.mockDbConfig) return ws
          return { ...ws, mockDbConfig: { ...ws.mockDbConfig, initialData: newInitialData } }
        })
      )
      setWorkspaces((prev) => {
        const ws = prev.find((w) => w.isRunning && w.mockDbConfig)
        if (ws) addLog(ws.id, `Mock DB synced: ${collections.length} collections, ${totalItems} items`, 'info')
        return prev
      })
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
    setActiveTab('requests')
  }

  const addLog = (workspaceId: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws
        return { ...ws, logs: [...ws.logs, { timestamp: new Date().toLocaleTimeString(), message, type }] }
      })
    )
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
            setTimeout(() => addLog(id, `Spec parsed: ${newEndpoints.length} endpoints, ${parsed.variables.length} variables`, 'info'), 0)
            return { ...ws, ...updates, endpoints: newEndpoints, variables: newVariables }
          } catch {
            setTimeout(() => addLog(id, 'Spec parse failed', 'error'), 0)
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
    if (updates.mockDbConfig !== undefined) {
      if (updates.mockDbConfig?.initialData) {
        addLog(id, 'Mock DB updated', 'info')
        if (adapter.updateMockDb) {
          const ws = workspaces.find((w) => w.id === id)
          if (ws?.isRunning) adapter.updateMockDb(updates.mockDbConfig.initialData)
        }
      } else {
        addLog(id, 'Mock DB disabled', 'info')
        if (adapter.updateMockDb) {
          const ws = workspaces.find((w) => w.id === id)
          if (ws?.isRunning) adapter.updateMockDb('')
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
        addLog(id, 'Server stopped', 'info')
        toast.success(`Server stopped`, {
          description: variant === 'extension' ? `${ws.name} is no longer capturing requests` : `${ws.name} is no longer running on port ${ws.port}`,
        })
      } catch (err: unknown) {
        addLog(id, `Failed to stop: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
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
        addLog(id, `Server started with ${activeEndpoints.length} endpoint${activeEndpoints.length !== 1 ? 's' : ''}`, 'success')
        if (ws.mockDbConfig) addLog(id, 'Mock DB active', 'info')
        toast.success(variant === 'extension' ? 'Recording started' : 'Server started', {
          description:
            variant === 'extension'
              ? activeEndpoints.length > 0
                ? `${ws.name} is capturing requests (${activeEndpoints.length} endpoint${activeEndpoints.length !== 1 ? 's' : ''})`
                : `${ws.name} is capturing requests`
              : `${ws.name} is running on port ${ws.port} with ${activeEndpoints.length} endpoint${activeEndpoints.length !== 1 ? 's' : ''}`,
        })
      } else {
        addLog(id, `Failed to start: ${result?.error || 'Unknown error'}`, 'error')
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
    addLog(duplicated.id, `Duplicated from "${ws.name}"`, 'info')
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
        const ep = newEndpoints[index]
        const willEnable = ep.enabled === false
        newEndpoints[index] = { ...ep, enabled: willEnable }
        return { ...ws, endpoints: newEndpoints }
      })
    )
    const ws = workspaces.find((w) => w.id === workspaceId)
    if (ws) {
      const ep = ws.endpoints[index]
      const willEnable = ep.enabled === false
      addLog(workspaceId, `Endpoint ${willEnable ? 'enabled' : 'disabled'}: ${ep.method} ${ep.path}`, 'info')
    }
  }

  const toggleAllEndpoints = (workspaceId: string, enabled: boolean) => {
    setWorkspaces((prev) =>
      prev.map((ws) => (ws.id !== workspaceId ? ws : { ...ws, endpoints: ws.endpoints.map((ep) => ({ ...ep, enabled })) }))
    )
    addLog(workspaceId, `All endpoints ${enabled ? 'enabled' : 'disabled'}`, 'info')
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
    if (!activeId && workspaces.length > 0) {
      setActiveId(workspaces[0].id)
    }
  }, [workspaces, activeId])

  const activeWorkspace = workspaces.find((w) => w.id === activeId)

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

  // Responsive width detection
  useEffect(() => {
    if (variant === 'extension') return // extension is always compact
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setIsCompact(entry.contentRect.width < COMPACT_BREAKPOINT)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [variant])

  // Panel helpers (wide mode)
  const togglePanel = (panelId: PanelId) => {
    const position = PANEL_POSITIONS[panelId]
    setActivePanels((prev) => {
      if (prev[position] === panelId) {
        const next = { ...prev }
        delete next[position]
        return next
      }
      return { ...prev, [position]: panelId }
    })
  }

  const closePanel = (position: PanelPosition) => {
    setActivePanels((prev) => {
      const next = { ...prev }
      delete next[position]
      return next
    })
  }

  // Nav click handler — adapts to compact / wide
  const handleNavClick = (tab: NavTab) => {
    setActiveTab(tab)
    if (!isCompact) {
      if (tab === 'requests') {
        // "History" = focus on center, close side panels
        setActivePanels({})
      } else {
        togglePanel(tab as PanelId)
      }
    }
  }

  const isNavActive = (tab: NavTab) => {
    if (isCompact) return activeTab === tab
    if (tab === 'requests') return !activePanels.left && !activePanels.right
    return activePanels[PANEL_POSITIONS[tab as PanelId]] === tab
  }

  // Elapsed timer
  useEffect(() => {
    if (activeWorkspace?.isRunning) {
      if (!startTimeRef.current) startTimeRef.current = Date.now()
      const tick = () => setElapsedMs(Date.now() - (startTimeRef.current ?? Date.now()))
      tick()
      const id = setInterval(tick, 1000)
      return () => clearInterval(id)
    } else {
      startTimeRef.current = null
      setElapsedMs(0)
    }
  }, [activeWorkspace?.isRunning])

  const formatElapsed = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return [hours, minutes, seconds].map((n) => n.toString().padStart(2, '0')).join(' : ')
  }

  const terminalLogs = activeWorkspace
    ? activeWorkspace.logs
    : workspaces.flatMap((w) => w.logs)

  // --- Shared nav items (same for extension and desktop) ---
  const navItems: Array<{ id: NavTab; icon: React.ReactNode; label: string }> = [
    { id: 'workspaces', icon: <Layers className="w-4 h-4" />, label: 'Workspaces' },
    { id: 'definitions', icon: <Sliders className="w-4 h-4" />, label: 'Definitions' },
    { id: 'requests', icon: <History className="w-4 h-4" />, label: 'History' },
    { id: 'database', icon: <Database className="w-4 h-4" />, label: 'Database' },
    { id: 'mocks', icon: <Server className="w-4 h-4" />, label: 'Mocks' },
  ]

  const horizontalPanelKey = `${activePanels.left || 'none'}-${activePanels.right || 'none'}`

  const renderPanelContent = (panelId: PanelId) => {
    switch (panelId) {
      case 'workspaces':
        return (
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
        )
      case 'definitions':
        return activeWorkspace ? (
          <DefinitionsModal
            workspace={activeWorkspace}
            isOpen={true}
            onClose={() => closePanel('left')}
            onUpdate={(u) => updateWorkspace(activeWorkspace.id, u)}
            isRunning={activeWorkspace.isRunning}
            onToggleServer={() => toggleServer(activeWorkspace.id)}
            onRestartServer={() => restartServer(activeWorkspace.id)}
            embedded
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">Select a workspace</div>
        )
      case 'database':
        return activeWorkspace ? (
          <MockDbPanel workspace={activeWorkspace} onUpdate={(u) => updateWorkspace(activeWorkspace.id, u)} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">Select a workspace</div>
        )
      case 'mocks':
        return activeWorkspace ? (
          <MockPanel workspace={activeWorkspace} onUpdate={(u) => updateWorkspace(activeWorkspace.id, u)} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">Select a workspace</div>
        )
      case 'settings':
        return (
          <SettingsPage
            workspace={activeWorkspace || null}
            onUpdate={(u) => activeWorkspace && updateWorkspace(activeWorkspace.id, u)}
            variant={variant}
          />
        )
      default:
        return null
    }
  }

  // --- Compact mode: single view content (like extension) ---
  const renderCompactContent = () => {
    if (activeTab === 'settings') {
      return (
        <SettingsPage
          workspace={activeWorkspace || null}
          onUpdate={(u) => activeWorkspace && updateWorkspace(activeWorkspace.id, u)}
          variant={variant}
        />
      )
    }
    if (activeTab === 'workspaces') {
      return (
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
      )
    }
    if (activeTab === 'database' && activeWorkspace) {
      return <MockDbPanel workspace={activeWorkspace} onUpdate={(u) => updateWorkspace(activeWorkspace.id, u)} />
    }
    if (activeTab === 'mocks' && activeWorkspace) {
      return <MockPanel workspace={activeWorkspace} onUpdate={(u) => updateWorkspace(activeWorkspace.id, u)} />
    }
    if (activeWorkspace) {
      return (
        <WorkspaceView
          workspace={activeWorkspace}
          onUpdate={(u) => updateWorkspace(activeWorkspace.id, u)}
          onToggleServer={() => toggleServer(activeWorkspace.id)}
          onRestartServer={() => restartServer(activeWorkspace.id)}
          onEndpointToggle={(idx) => toggleEndpoint(activeWorkspace.id, idx)}
          onToggleAllEndpoints={(enabled) => toggleAllEndpoints(activeWorkspace.id, enabled)}
          onClearLogs={() => clearLogs(activeWorkspace.id)}
          variant="extension"
          isEndpointsPanelOpen={activeTab === 'definitions'}
          onCloseEndpointsPanel={() => setActiveTab('requests')}
        />
      )
    }
    return <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">Select a workspace</div>
  }

  // --- Unified layout ---
  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex flex-1 min-h-0 h-screen w-screen overflow-hidden bg-zinc-900 text-white font-sans selection:bg-blue-500/30">
      {/* Icon sidebar */}
        <aside
          className="flex flex-col items-center bg-zinc-900 shrink-0 py-2 px-1.5 gap-1"
          style={{
            width: 50,
            paddingTop: nativeWindowDrag && isMac ? 30 : 8,
          }}
        >
          {navItems.map(({ id, icon, label }) => (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNavClick(id)}
                  className={cn(
                    'w-10 h-10 px-3 flex items-center justify-center shrink-0 rounded-md transition-colors',
                    isNavActive(id)
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                  )}
                >
                  {icon}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ))}
          <div className="mt-auto flex flex-col items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNavClick('settings')}
                  className={cn(
                    'w-10 h-10  flex items-center justify-center shrink-0 rounded-md transition-colors',
                    isNavActive('settings')
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                  )}
                >
                  <Settings className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsTerminalOpen((v) => !v)}
                  className={cn(
                    'w-10 h-10 flex items-center justify-center shrink-0 rounded-md transition-colors',
                    isTerminalOpen
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                  )}
                >
                  <Terminal className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Terminal</TooltipContent>
            </Tooltip>
          </div>
        </aside>

      {/* Content area */}
      <div ref={contentRef} className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        {/* Header bar */}
        <div
          className="h-10 bg-zinc-900 flex items-center justify-between shrink-0 relative z-50 px-3"
          style={{
            ...(nativeWindowDrag ? { WebkitAppRegion: 'drag' } : {}),
          }}
        >
          <div
            className="flex items-center gap-2"
            style={nativeWindowDrag ? { WebkitAppRegion: 'no-drag' } : undefined}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors text-xs hover:bg-zinc-800 text-zinc-300 font-medium min-w-0">
                  <span className="truncate max-w-[200px]">{activeWorkspace?.name ?? 'Workspaces'}</span>
                  <ChevronsUpDown className="w-3 h-3 text-zinc-500 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem onClick={() => handleNavClick('workspaces')} className="text-zinc-300">
                  <Layers className="w-4 h-4 text-zinc-400" />
                  <span className="font-medium">Manage Workspaces</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {workspaces.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-zinc-500 text-center">No workspaces</div>
                ) : (
                  workspaces.map((ws) => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => handleSelectWorkspace(ws.id)}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{ws.name}</div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                          {variant === 'desktop' && <span className="font-mono">PORT: {ws.port}</span>}
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

          <div
            className="flex items-center gap-3"
            style={nativeWindowDrag ? { WebkitAppRegion: 'no-drag' } : undefined}
          >
            {activeWorkspace && (
              <>
                {variant === 'desktop' && (
                  <div className="flex items-center gap-2 text-zinc-500 bg-zinc-900/50 px-2.5 py-1 rounded border border-zinc-800">
                    <span className="text-[10px] font-mono">Port</span>
                    <input
                      type="number"
                      value={activeWorkspace.port}
                      onChange={(e) => updateWorkspace(activeWorkspace.id, { port: parseInt(e.target.value) || 0 })}
                      className="bg-transparent w-14 text-xs font-mono text-zinc-200 focus:outline-none text-center"
                    />
                  </div>
                )}
                {activeWorkspace.isRunning && (
                  <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                    {formatElapsed(elapsedMs)}
                  </span>
                )}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => !activeWorkspace.isRunning && toggleServer(activeWorkspace.id)}
                    disabled={activeWorkspace.isRunning || (variant === 'desktop' && !activeWorkspace.endpoints.length)}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      activeWorkspace.isRunning || (variant === 'desktop' && !activeWorkspace.endpoints.length)
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
                    onClick={() => activeWorkspace.isRunning && restartServer(activeWorkspace.id)}
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
              </>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 min-h-0 flex flex-col mr-2 mb-2 gap-1.5">
          {isCompact ? (
            /* --- Compact mode: single view (extension-like) --- */
            <>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-zinc-950 rounded-xl border border-zinc-800">
                {renderCompactContent()}
              </div>
              {isTerminalOpen && (
                <div className="h-48 shrink-0 overflow-hidden flex flex-col bg-zinc-950 rounded-xl border border-zinc-800">
                  <PanelWrapper title="Terminal" onClose={() => setIsTerminalOpen(false)}>
                    <TerminalPage logs={terminalLogs} />
                  </PanelWrapper>
                </div>
              )}
            </>
          ) : (
            /* --- Wide mode: dockable panels (DataGrip-like) --- */
            <>
              <div className="flex-1 min-h-0 overflow-hidden">
                <ResizablePanelGroup direction="horizontal" key={horizontalPanelKey}>
                  {/* Left docked panel */}
                  {activePanels.left && (
                    <>
                      <ResizablePanel defaultSize={28} minSize={15}>
                        <div className="h-full rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden">
                          <PanelWrapper title={PANEL_TITLES[activePanels.left]} onClose={() => closePanel('left')}>
                            {renderPanelContent(activePanels.left)}
                          </PanelWrapper>
                        </div>
                      </ResizablePanel>
                      <ResizableHandle className="w-1.5 bg-transparent after:bg-transparent hover:bg-zinc-700/50 transition-colors rounded" />
                    </>
                  )}

                  {/* Center - always WorkspaceView */}
                  <ResizablePanel minSize={25}>
                    <div className="h-full overflow-hidden">
                      {activeWorkspace ? (
                        <WorkspaceView
                          workspace={activeWorkspace}
                          onUpdate={(u) => updateWorkspace(activeWorkspace.id, u)}
                          onToggleServer={() => toggleServer(activeWorkspace.id)}
                          onRestartServer={() => restartServer(activeWorkspace.id)}
                          onEndpointToggle={(idx) => toggleEndpoint(activeWorkspace.id, idx)}
                          onToggleAllEndpoints={(enabled) => toggleAllEndpoints(activeWorkspace.id, enabled)}
                          onClearLogs={() => clearLogs(activeWorkspace.id)}
                          variant={variant}
                        />
                      ) : (
                        <div className="flex-1 h-full flex items-center justify-center text-zinc-600 text-sm rounded-xl bg-zinc-950 border border-zinc-800">
                          Select a workspace to get started
                        </div>
                      )}
                    </div>
                  </ResizablePanel>

                  {/* Right docked panel */}
                  {activePanels.right && (
                    <>
                      <ResizableHandle className="w-1.5 bg-transparent after:bg-transparent hover:bg-zinc-700/50 transition-colors rounded" />
                      <ResizablePanel defaultSize={30} minSize={15}>
                        <div className="h-full rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden">
                          <PanelWrapper title={PANEL_TITLES[activePanels.right]} onClose={() => closePanel('right')}>
                            {renderPanelContent(activePanels.right)}
                          </PanelWrapper>
                        </div>
                      </ResizablePanel>
                    </>
                  )}
                </ResizablePanelGroup>
              </div>

              {/* Bottom docked panel - Terminal */}
              {isTerminalOpen && (
                <div className="h-48 shrink-0 overflow-hidden flex flex-col rounded-xl bg-zinc-950 border border-zinc-800">
                  <PanelWrapper title="Terminal" onClose={() => setIsTerminalOpen(false)}>
                    <TerminalPage logs={terminalLogs} />
                  </PanelWrapper>
                </div>
              )}
            </>
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
    </TooltipProvider>
  )
}
