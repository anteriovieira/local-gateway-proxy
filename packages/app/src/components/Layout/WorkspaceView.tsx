import React, { useState } from 'react'
import { toast } from 'sonner'
import type { Workspace, ApiLogEntry } from '../../types'
import { EndpointList } from '../Switchboard/EndpointList'
import { EnhancedLogPanel } from '../Switchboard/EnhancedLogPanel'
import { DefinitionsModal } from '../Switchboard/DefinitionsModal'
import { CheckSquare, Sliders } from 'lucide-react'
import { cn, ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@proxy-app/ui'

interface WorkspaceViewProps {
  workspace: Workspace
  onUpdate: (updates: Partial<Workspace>) => void
  onToggleServer: () => void
  onRestartServer?: () => void
  onEndpointToggle: (index: number) => void
  onToggleAllEndpoints: (enabled: boolean) => void
  onClearLogs: () => void
  variant?: 'desktop' | 'extension'
  isEndpointsPanelOpen?: boolean
  onCloseEndpointsPanel?: () => void
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  workspace,
  onUpdate,
  onToggleServer,
  onRestartServer,
  onEndpointToggle,
  onToggleAllEndpoints,
  onClearLogs,
  variant = 'desktop',
  isEndpointsPanelOpen = false,
  onCloseEndpointsPanel,
}) => {
  const [isDefinitionsModalOpen, setIsDefinitionsModalOpen] = useState(false)
  const [logSearchQuery, setLogSearchQuery] = useState('')

  const allEndpointsEnabled = workspace.endpoints.length > 0 && workspace.endpoints.every((ep) => ep.enabled !== false)

  const handleEndpointClick = (path: string) => {
    setLogSearchQuery(path)
  }

  const handleAddToDefinitions = (log: ApiLogEntry) => {
    try {
      const data = JSON.parse(workspace.configContent || '{}')
      data.paths = data.paths || {}
      const path = log.path
      const method = (log.method || 'GET').toLowerCase()
      if (data.paths[path]?.[method]) {
        toast.info('Endpoint already in definitions', { description: `${log.method} ${path}` })
        return
      }
      if (!data.paths[path]) data.paths[path] = {}
      const uri = log.targetUrl || 'https://api.example.com'
      const integrationProp = workspace.integrationProperty || 'x-amazon-apigateway-integration'
      data.paths[path][method] = {
        [integrationProp]: {
          uri,
          type: 'http_proxy',
          httpMethod: (log.method || 'GET').toUpperCase(),
          responses: { default: { statusCode: '200' } },
          passthroughBehavior: 'when_no_match',
        },
      }
      onUpdate({ configContent: JSON.stringify(data, null, 2) })
      toast.success('Added to definitions', { description: `${log.method} ${path}` })
    } catch {
      toast.error('Failed to add to definitions', { description: 'Invalid config format' })
    }
  }

  const handleCreateMock = (log: ApiLogEntry) => {
    const method = (log.method || 'GET').toUpperCase()
    const path = log.path

    // Check if a mock already exists for this path+method
    const existingMock = workspace.endpoints.find(
      (ep) => ep.isMock && ep.path === path && ep.method.toUpperCase() === method
    )
    if (existingMock) {
      toast.info('Mock already exists', { description: `${method} ${path}` })
      return
    }

    // Try to pretty-print JSON response body
    let responseBody = log.responseBody || '{}'
    try {
      responseBody = JSON.stringify(JSON.parse(responseBody), null, 2)
    } catch {
      // keep as-is if not valid JSON
    }

    const contentType = log.responseHeaders?.['content-type'] ?? 'application/json'

    const newEndpoints = [
      ...workspace.endpoints,
      {
        path,
        method,
        uriTemplate: '',
        isMock: true,
        enabled: true,
        mockResponse: responseBody,
        mockStatusCode: log.statusCode ?? 200,
        mockHeaders: { 'content-type': contentType },
        mockDelay: 0,
      },
    ]
    onUpdate({ endpoints: newEndpoints })
    toast.success('Mock created', { description: `${method} ${path}` })
  }

  const endpointsPanelContent = () => (
    <div className="h-full min-h-0 flex flex-col flex-1 overflow-hidden border-r border-zinc-900 bg-zinc-900/20">
      <div className="flex flex-row justify-between items-center p-3 border-b border-zinc-900 bg-zinc-900/30">
        <span className="text-xs font-medium text-zinc-400 flex-shrink-0">Endpoints</span>
        <div className="flex flex-row items-center gap-2 flex-shrink-0">
          <span className="text-xs text-zinc-600 whitespace-nowrap">{workspace.endpoints.filter((e) => e.enabled !== false).length} active</span>
          {workspace.endpoints.length > 0 && (
            <button
              onClick={() => onToggleAllEndpoints(!allEndpointsEnabled)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors border whitespace-nowrap",
                allEndpointsEnabled ? "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20" : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
              )}
              title={allEndpointsEnabled ? "Unmark all" : "Mark all"}
            >
              <CheckSquare className="w-3 h-3" />
              <span>{allEndpointsEnabled ? "Unmark all" : "Mark all"}</span>
            </button>
          )}
          <button
            onClick={() => setIsDefinitionsModalOpen(true)}
            className="px-3 py-1 text-xs bg-zinc-900 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-300 flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Sliders className="w-3.5 h-3.5" />
            Definitions
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden p-4 flex flex-col">
        <EndpointList endpoints={workspace.endpoints} variables={workspace.variables} onToggle={onEndpointToggle} onEndpointClick={handleEndpointClick} />
      </div>
    </div>
  )

  if (variant === 'extension' && isEndpointsPanelOpen) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
        <div className="flex-1 min-h-0 overflow-hidden">
          {endpointsPanelContent()}
        </div>
        <DefinitionsModal
          workspace={workspace}
          isOpen={isDefinitionsModalOpen}
          onClose={() => setIsDefinitionsModalOpen(false)}
          onUpdate={onUpdate}
          isRunning={workspace.isRunning}
          onToggleServer={onToggleServer}
          onRestartServer={onRestartServer}
        />
      </div>
    )
  }

  if (variant === 'extension') {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
        <EnhancedLogPanel
          apiLogs={workspace.apiLogs || []}
          onClearLogs={onClearLogs}
          searchQuery={logSearchQuery}
          onSearchQueryChange={setLogSearchQuery}
          onAddToDefinitions={handleAddToDefinitions}
          onCreateMock={handleCreateMock}
          endpoints={workspace.endpoints}
          variant="extension"
        />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-950 w-full h-full">
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0 w-full h-full">
        <ResizablePanel defaultSize={40} minSize={25}>
          {endpointsPanelContent()}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={60} minSize={15}>
          <EnhancedLogPanel
            apiLogs={workspace.apiLogs || []}
            onClearLogs={onClearLogs}
            searchQuery={logSearchQuery}
            onSearchQueryChange={setLogSearchQuery}
            onAddToDefinitions={handleAddToDefinitions}
            onCreateMock={handleCreateMock}
            endpoints={workspace.endpoints}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      <DefinitionsModal
        workspace={workspace}
        isOpen={isDefinitionsModalOpen}
        onClose={() => setIsDefinitionsModalOpen(false)}
        onUpdate={onUpdate}
        isRunning={workspace.isRunning}
        onToggleServer={onToggleServer}
        onRestartServer={onRestartServer}
      />
    </div>
  )
}
