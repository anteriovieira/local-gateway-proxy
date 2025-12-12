import React, { useState } from 'react'
import { X, Variable, Code, Check } from 'lucide-react'
import Editor from 'react-simple-code-editor'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-json'
import { Workspace } from '../../types'
import { cn } from '../../utils'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../ui/resizable'

interface DefinitionsModalProps {
    workspace: Workspace | null
    isOpen: boolean
    onClose: () => void
    onUpdate: (updates: Partial<Workspace>) => void
    isRunning?: boolean
    onToggleServer?: () => void
    onRestartServer?: () => void
}

export const DefinitionsModal: React.FC<DefinitionsModalProps> = ({
    workspace,
    isOpen,
    onClose,
    onUpdate,
    isRunning = false,
    onToggleServer,
    onRestartServer
}) => {
    const [isApplying, setIsApplying] = useState(false)
    const [localWorkspace, setLocalWorkspace] = useState<Workspace | null>(workspace)

    // Sync local workspace with prop changes
    React.useEffect(() => {
        if (workspace) {
            setLocalWorkspace(workspace)
        }
    }, [workspace])

    if (!isOpen || !workspace || !localWorkspace) return null

    const handleApply = async () => {
        setIsApplying(true)
        try {
            // Apply the changes first
            onUpdate({
                configContent: localWorkspace.configContent,
                variables: localWorkspace.variables
            })

            // If server is running, restart it using the dedicated restart function
            if (isRunning && onRestartServer) {
                await onRestartServer()
            } else if (isRunning && onToggleServer) {
                // Fallback to toggle if restart is not available
                // Stop the server first
                await onToggleServer()
                // Wait for the server to fully stop
                await new Promise(resolve => setTimeout(resolve, 1000))
                // Start it again
                await onToggleServer()
            }

            // Close the modal
            setIsApplying(false)
            onClose()
        } catch (error) {
            console.error('Failed to apply changes:', error)
            setIsApplying(false)
        }
    }

    const handleConfigChange = (code: string) => {
        setLocalWorkspace({ ...localWorkspace, configContent: code })
        onUpdate({ configContent: code })
    }

    const handleVariableChange = (key: string, value: string) => {
        const newVars = { ...localWorkspace.variables, [key]: value }
        setLocalWorkspace({ ...localWorkspace, variables: newVars })
        onUpdate({ variables: newVars })
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-2 border-b border-zinc-800 shrink-0">
                    <h2 className="text-xl font-semibold text-white">Definitions</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Two Column Content with Resizable Panels */}
                <ResizablePanelGroup direction="horizontal" className="flex-1">
                    {/* Left Column - Spec (Configuration) */}
                    <ResizablePanel defaultSize={50} minSize={30}>
                        <div className="h-full flex flex-col bg-zinc-950/50">
                            <div className="px-6 py-3 border-b border-zinc-800 shrink-0 flex items-center gap-2">
                                <Code className="w-4 h-4 text-zinc-400" />
                                <h3 className="text-sm font-semibold text-zinc-300">Spec</h3>
                            </div>
                            <div className="flex-1 overflow-y-scroll custom-scrollbar">
                                <Editor
                                    value={localWorkspace.configContent}
                                    onValueChange={handleConfigChange}
                                    highlight={(code) => highlight(code, languages.json, 'json')}
                                    padding={16}
                                    style={{
                                        fontFamily: '"Fira Code", "Fira Mono", "Consolas", "Monaco", monospace',
                                        fontSize: 13,
                                        backgroundColor: '#09090b',
                                        color: '#fafafa',
                                        outline: 'none',
                                        minHeight: '100%',
                                    }}
                                    textareaClassName="outline-none h-full"
                                    className="w-full block h-full"
                                    placeholder="Paste your gateway API configuration JSON here..."
                                />
                            </div>
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    {/* Right Column - Variables */}
                    <ResizablePanel defaultSize={50} minSize={30}>
                        <div className="h-full flex flex-col">
                            <div className="px-6 py-3 border-b border-zinc-800 shrink-0 flex items-center gap-2">
                                <Variable className="w-4 h-4 text-zinc-400" />
                                <h3 className="text-sm font-semibold text-zinc-300">Variables</h3>
                            </div>
                            <div className="flex-1 overflow-y-scroll custom-scrollbar p-6">
                                {Object.keys(localWorkspace.variables).length === 0 ? (
                                    <div className="text-center py-12 text-zinc-500 text-sm">
                                        No variables configured
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {Object.entries(localWorkspace.variables).map(([key, value]) => (
                                            <div key={key} className="flex flex-col gap-2">
                                                <label className="text-xs text-zinc-400 font-mono">{key}</label>
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => handleVariableChange(key, e.target.value)}
                                                    className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-white font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 w-full"
                                                    placeholder="Enter value..."
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>

                {/* Footer with Apply Button */}
                <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-zinc-800 shrink-0 bg-zinc-950/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={isApplying}
                        className={cn(
                            "px-4 py-2 text-sm font-medium text-white rounded-md transition-colors flex items-center gap-2",
                            isApplying
                                ? "bg-blue-600/50 cursor-not-allowed"
                                : "bg-blue-600 hover:bg-blue-700"
                        )}
                    >
                        {isApplying ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Applying...</span>
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                <span>Apply {isRunning ? '& Reload Server' : ''}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
