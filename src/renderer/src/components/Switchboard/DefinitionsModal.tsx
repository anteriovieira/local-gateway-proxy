import React from 'react'
import { X, Variable, Code } from 'lucide-react'
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
}

export const DefinitionsModal: React.FC<DefinitionsModalProps> = ({
    workspace,
    isOpen,
    onClose,
    onUpdate
}) => {
    if (!isOpen || !workspace) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-6xl h-[700px] overflow-hidden flex flex-col shadow-2xl"
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
                                    value={workspace.configContent}
                                    onValueChange={(code) => onUpdate({ configContent: code })}
                                    highlight={(code) => highlight(code, languages.json, 'json')}
                                    padding={16}
                                    style={{
                                        fontFamily: '"Fira Code", "Fira Mono", "Consolas", "Monaco", monospace',
                                        fontSize: 13,
                                        backgroundColor: '#09090b',
                                        color: '#fafafa',
                                        outline: 'none',
                                    }}
                                    textareaClassName="outline-none"
                                    className="w-full block"
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
                                {Object.keys(workspace.variables).length === 0 ? (
                                    <div className="text-center py-12 text-zinc-500 text-sm">
                                        No variables configured
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {Object.entries(workspace.variables).map(([key, value]) => (
                                            <div key={key} className="flex flex-col gap-2">
                                                <label className="text-xs text-zinc-400 font-mono">{key}</label>
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => {
                                                        const newVars = { ...workspace.variables, [key]: e.target.value }
                                                        onUpdate({ variables: newVars })
                                                    }}
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
            </div>
        </div>
    )
}
