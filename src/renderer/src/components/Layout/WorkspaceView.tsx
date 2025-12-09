import React, { useRef, useState } from 'react'
import { Workspace } from '../../types'
import { EndpointList } from '../Switchboard/EndpointList'
import { Terminal } from '../Switchboard/Terminal'
import { Upload, ChevronDown, ChevronRight, CheckSquare, Trash2 } from 'lucide-react'
import { cn } from '../../utils'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../ui/resizable'
import { JsonEditor } from '../ui/JsonEditor'

interface WorkspaceViewProps {
    workspace: Workspace
    onUpdate: (updates: Partial<Workspace>) => void
    onToggleServer: () => void
    onEndpointToggle: (index: number) => void
    onToggleAllEndpoints: (enabled: boolean) => void
    onClearLogs: () => void
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ workspace, onUpdate, onToggleServer, onEndpointToggle, onToggleAllEndpoints, onClearLogs }) => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isConfigExpanded, setIsConfigExpanded] = useState(true)
    const [isVariablesExpanded, setIsVariablesExpanded] = useState(true)

    const allEndpointsEnabled = workspace.endpoints.length > 0 && workspace.endpoints.every(ep => ep.enabled !== false)

    // Handlers
    const handleConfigChange = (value: string) => onUpdate({ configContent: value })

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
                const content = event.target?.result as string
                onUpdate({ configContent: content })
            }
            reader.readAsText(file)
        }
        // Reset input so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileImport}
                className="hidden"
            />

            {/* Header */}
            {/* Main Resizable Panels */}
            <ResizablePanelGroup direction="horizontal" className="flex-1">
                {/* Panel 1: Config */}
                <ResizablePanel defaultSize={25} minSize={15} maxSize={50}>
                    <div className="h-full flex flex-col border-r border-zinc-900 overflow-hidden">
                        {/* Config Section */}
                        <div
                            className="p-3 border-b border-zinc-900 bg-zinc-900/30 text-xs font-medium text-zinc-400 uppercase tracking-wider flex justify-between items-center cursor-pointer hover:bg-zinc-900/50 transition-colors"
                            onClick={() => setIsConfigExpanded(!isConfigExpanded)}
                        >
                            <div className="flex items-center gap-2">
                                {isConfigExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                <span>Config (JSON)</span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    fileInputRef.current?.click()
                                }}
                                className="flex items-center gap-1 text-zinc-500 hover:text-white transition-colors"
                                title="Import JSON file"
                            >
                                <Upload className="w-3 h-3" />
                                <span className="text-[10px]">Import</span>
                            </button>
                        </div>

                        {/* Collapsible JSON Editor */}
                        {isConfigExpanded && (
                            <div className="flex-1 min-h-0 overflow-hidden">
                                <JsonEditor
                                    value={workspace.configContent}
                                    onChange={handleConfigChange}
                                    placeholder="// Paste or import gateway-api.json here..."
                                />
                            </div>
                        )}

                        {/* Variables Section */}
                        <div
                            className="p-3 border-t border-b border-zinc-900 bg-zinc-900/30 text-xs font-medium text-zinc-400 uppercase tracking-wider shrink-0 cursor-pointer hover:bg-zinc-900/50 transition-colors flex items-center gap-2"
                            onClick={() => setIsVariablesExpanded(!isVariablesExpanded)}
                        >
                            {isVariablesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            <span>Variables</span>
                            <span className="text-zinc-600 ml-auto">{Object.keys(workspace.variables).length}</span>
                        </div>

                        {/* Collapsible Variables Content */}
                        {isVariablesExpanded && (
                            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-3">
                                {Object.entries(workspace.variables).map(([k, v]) => (
                                    <div key={k} className="flex flex-col gap-1">
                                        <label className="text-[10px] text-zinc-500 font-mono">{k}</label>
                                        <input
                                            value={v}
                                            onChange={(e) => {
                                                const newVars = { ...workspace.variables, [k]: e.target.value }
                                                onUpdate({ variables: newVars })
                                            }}
                                            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 font-mono focus:border-blue-500/50 focus:outline-none"
                                        />
                                    </div>
                                ))}
                                {Object.keys(workspace.variables).length === 0 && (
                                    <p className="text-zinc-600 text-xs italic">No variables detected in config</p>
                                )}
                            </div>
                        )}
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Panel 2: Switchboard */}
                <ResizablePanel defaultSize={45} minSize={25}>
                    <div className="h-full flex flex-col border-r border-zinc-900 bg-zinc-900/20">
                        <div className="p-3 border-b border-zinc-900 bg-zinc-900/30 text-xs font-medium text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                            <span>Switchboard</span>
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

                {/* Panel 3: Terminal */}
                <ResizablePanel defaultSize={30} minSize={15}>
                    <div className="h-full flex flex-col bg-black">
                        <div className="p-3 border-b border-zinc-900 bg-zinc-900/30 text-xs font-medium text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Live Logs</span>
                            {workspace.logs.length > 0 && (
                                <button
                                    onClick={onClearLogs}
                                    className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                                    title="Clear logs"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Clear</span>
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-hidden p-4">
                            <Terminal logs={workspace.logs} />
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    )
}
