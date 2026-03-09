import React, { useState } from 'react'
import { Plus, Activity, Network, GripVertical } from 'lucide-react'
import { Workspace } from '../../types'
import { cn } from '../../utils'

interface SidebarProps {
    workspaces: Workspace[]
    activeWorkspaceId: string | null
    onSelectWorkspace: (id: string) => void
    onAddWorkspace: () => void
    onReorderWorkspaces: (fromIndex: number, toIndex: number) => void
}

export const Sidebar: React.FC<SidebarProps> = ({ workspaces, activeWorkspaceId, onSelectWorkspace, onAddWorkspace, onReorderWorkspaces }) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/html', e.currentTarget.outerHTML)
        // Add a slight delay to allow drag image to be set
        setTimeout(() => {
            if (e.currentTarget instanceof HTMLElement) {
                e.currentTarget.style.opacity = '0.5'
            }
        }, 0)
    }

    const handleDragEnd = (e: React.DragEvent) => {
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1'
        }
        setDraggedIndex(null)
        setDragOverIndex(null)
    }

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOverIndex(index)
    }

    const handleDragLeave = () => {
        setDragOverIndex(null)
    }

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault()
        if (draggedIndex !== null && draggedIndex !== dropIndex) {
            onReorderWorkspaces(draggedIndex, dropIndex)
        }
        setDraggedIndex(null)
        setDragOverIndex(null)
    }

    return (
        <div className="w-64 bg-zinc-950 border-r border-zinc-900 flex flex-col h-full">
            <div className="p-4 border-b border-zinc-900 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-white/10">
                    <Network className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                    <h1 className="text-sm font-bold text-white">Local Gateway Proxy</h1>
                    <p className="text-[10px] text-zinc-500">API Emulator</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {workspaces.map((ws, index) => (
                    <div
                        key={ws.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        className={cn(
                            "group relative rounded-lg transition-all border border-transparent cursor-move",
                            activeWorkspaceId === ws.id
                                ? "bg-zinc-900 border-zinc-800 shadow-lg shadow-black/40"
                                : "hover:bg-zinc-900/50",
                            draggedIndex === index && "opacity-50",
                            dragOverIndex === index && draggedIndex !== index && "border-blue-500/50 bg-blue-500/10"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            {/* Drag handle */}
                            <div className="flex-shrink-0 p-2 text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing">
                                <GripVertical className="w-4 h-4" />
                            </div>
                            
                            <button
                                onClick={() => onSelectWorkspace(ws.id)}
                                className={cn(
                                    "flex-1 text-left p-3 rounded-lg transition-all",
                                    activeWorkspaceId === ws.id
                                        ? "text-white"
                                        : "text-zinc-400 hover:text-zinc-200"
                                )}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-semibold truncate">{ws.name}</span>
                                    <div className={cn(
                                        "h-2 w-2 rounded-full shrink-0",
                                        ws.isRunning ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-700"
                                    )} />
                                </div>
                                <div className="flex items-center text-xs text-zinc-600 font-mono">
                                    <span className="mr-2">PORT: {ws.port}</span>
                                    {ws.isRunning && (
                                        <Activity className="w-3 h-3 text-emerald-500 animate-pulse ml-auto" />
                                    )}
                                </div>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-zinc-900">
                <button
                    onClick={onAddWorkspace}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>New Workspace</span>
                </button>
            </div>
        </div>
    )
}
