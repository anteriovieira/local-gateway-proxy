import React, { useState } from 'react'
import { Workspace } from '../../types'
import { EndpointList } from '../Switchboard/EndpointList'
import { EnhancedLogPanel } from '../Switchboard/EnhancedLogPanel'
import { TerminalLogModal } from '../Switchboard/TerminalLogModal'
import { DefinitionsModal } from '../Switchboard/DefinitionsModal'
import { CheckSquare, Sliders } from 'lucide-react'
import { cn } from '../../utils'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../ui/resizable'

interface WorkspaceViewProps {
    workspace: Workspace
    onUpdate: (updates: Partial<Workspace>) => void
    onToggleServer: () => void
    onEndpointToggle: (index: number) => void
    onToggleAllEndpoints: (enabled: boolean) => void
    onClearLogs: () => void
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ workspace, onUpdate, onToggleServer, onEndpointToggle, onToggleAllEndpoints, onClearLogs }) => {
    const [isTerminalLogOpen, setIsTerminalLogOpen] = useState(false)
    const [isDefinitionsModalOpen, setIsDefinitionsModalOpen] = useState(false)

    const allEndpointsEnabled = workspace.endpoints.length > 0 && workspace.endpoints.every(ep => ep.enabled !== false)

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
            {/* Main Resizable Panels */}
            <ResizablePanelGroup direction="horizontal" className="flex-1">

                {/* Panel 1: Switchboard */}
                <ResizablePanel defaultSize={55} minSize={25}>
                    <div className="h-full flex flex-col border-r border-zinc-900 bg-zinc-900/20">
                        <div className="p-3 border-b border-zinc-900 bg-zinc-900/30 text-xs font-medium text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                            <span>Endpoints</span>
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-600">{workspace.endpoints.filter(e => e.enabled !== false).length} Active</span>
                                {workspace.endpoints.length > 0 && (
                                    <button
                                        onClick={() => onToggleAllEndpoints(!allEndpointsEnabled)}
                                        className={cn(
                                            "flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors border",
                                            allEndpointsEnabled
                                                ? "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                                                : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                                        )}
                                        title={allEndpointsEnabled ? "Unmark All" : "Mark All"}
                                    >
                                        <CheckSquare className="w-3 h-3" />
                                        <span>{allEndpointsEnabled ? "Unmark All" : "Mark All"}</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsDefinitionsModalOpen(true)}
                                    className="px-3 py-1 text-xs bg-zinc-900 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-300 flex items-center gap-1.5 transition-colors"
                                    
                                >
                                    <Sliders className="w-3.5 h-3.5" />
                                    Definitions
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden p-4">
                            <EndpointList 
                                endpoints={workspace.endpoints} 
                                onToggle={onEndpointToggle}
                            />
                        </div>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Panel 2: Enhanced Log Panel */}
                <ResizablePanel defaultSize={45} minSize={15}>
                    <EnhancedLogPanel
                        apiLogs={workspace.apiLogs || []}
                        onClearLogs={onClearLogs}
                        onOpenTerminalLog={() => setIsTerminalLogOpen(true)}
                    />
                </ResizablePanel>
            </ResizablePanelGroup>

            {/* Terminal Log Modal */}
            <TerminalLogModal
                isOpen={isTerminalLogOpen}
                onClose={() => setIsTerminalLogOpen(false)}
                logs={workspace.logs}
            />

            {/* Definitions Modal */}
            <DefinitionsModal
                workspace={workspace}
                isOpen={isDefinitionsModalOpen}
                onClose={() => setIsDefinitionsModalOpen(false)}
                onUpdate={onUpdate}
                isRunning={workspace.isRunning}
                onToggleServer={onToggleServer}
            />
        </div>
    )
}
