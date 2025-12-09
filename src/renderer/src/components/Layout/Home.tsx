import React, { useState, useRef, useEffect } from 'react'
import { Plus, Activity, GripVertical, Trash2, Play, Square, MoreVertical, Copy, FolderKanban } from 'lucide-react'
import { Workspace } from '../../types'
import { cn } from '../../utils'

interface HomeProps {
    workspaces: Workspace[]
    activeWorkspaceId: string | null
    onSelectWorkspace: (id: string) => void
    onAddWorkspace: () => void
    onReorderWorkspaces: (fromIndex: number, toIndex: number) => void
    onRemoveWorkspace: (id: string) => void
    onToggleServer: (id: string) => void
    onDuplicateWorkspace: (id: string) => void
}

export const Home: React.FC<HomeProps> = ({ workspaces, activeWorkspaceId, onSelectWorkspace, onAddWorkspace, onReorderWorkspaces, onRemoveWorkspace, onToggleServer, onDuplicateWorkspace }) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
    const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null)
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
    const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({})

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/html', e.currentTarget.outerHTML)
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

    const handleToggleServer = (e: React.MouseEvent, workspaceId: string) => {
        e.stopPropagation() // Prevent selecting the workspace
        onToggleServer(workspaceId)
        setOpenDropdownId(null) // Close dropdown
    }

    const handleDuplicate = (e: React.MouseEvent, workspaceId: string) => {
        e.stopPropagation()
        onDuplicateWorkspace(workspaceId)
        setOpenDropdownId(null)
    }

    const handleDelete = (e: React.MouseEvent, workspace: Workspace) => {
        e.stopPropagation()
        setWorkspaceToDelete(workspace)
        setOpenDropdownId(null)
    }

    const toggleDropdown = (e: React.MouseEvent, workspaceId: string) => {
        e.stopPropagation()
        setOpenDropdownId(openDropdownId === workspaceId ? null : workspaceId)
    }

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (openDropdownId) {
                const dropdownElement = dropdownRefs.current[openDropdownId]
                if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
                    setOpenDropdownId(null)
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [openDropdownId])

    const confirmDelete = () => {
        if (workspaceToDelete) {
            onRemoveWorkspace(workspaceToDelete.id)
            setWorkspaceToDelete(null)
        }
    }

    const cancelDelete = () => {
        setWorkspaceToDelete(null)
    }

    return (
        <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
            {/* Header */}
            <div className="relative border-b border-zinc-900/50 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-950/95">
                {/* Subtle background pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:24px_24px] opacity-20"></div>
                
                <div className="relative px-8 py-10">
                    <div className="flex items-start justify-between gap-6">
                        <div className="flex items-start gap-4">
                            {/* Title and description */}
                            <div>
                                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                                    Workspaces
                                </h1>
                                <p className="text-sm text-zinc-500 font-medium">
                                    Manage your proxy server configurations
                                </p>
                                {workspaces.length > 0 && (
                                    <div className="mt-3 flex items-center gap-4 text-xs text-zinc-600">
                                        <span className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>
                                            {workspaces.length} {workspaces.length === 1 ? 'workspace' : 'workspaces'}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Activity className={cn(
                                                "w-3.5 h-3.5",
                                                workspaces.some(w => w.isRunning) ? "text-emerald-500 animate-pulse" : "text-zinc-600"
                                            )} />
                                            {workspaces.filter(w => w.isRunning).length} running
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Create Workspace Button */}
                        <button
                            onClick={onAddWorkspace}
                            className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md hover:shadow-black/20 group"
                        >
                            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
                            <span>Create Workspace</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Workspaces List */}
            <div className="flex-1 overflow-y-auto">
                {workspaces.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-600 p-8">
                        <div className="mb-4 text-6xl">🚀</div>
                        <h2 className="text-xl font-semibold mb-2 text-zinc-400">No workspaces yet</h2>
                        <p className="text-sm mb-6">Create your first workspace to get started</p>
                        <button
                            onClick={onAddWorkspace}
                            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Create Workspace
                        </button>
                    </div>
                ) : (
                    <div className="p-6">
                        <div className="space-y-2">
                            {workspaces.map((ws, index) => (
                                <div
                                    key={ws.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onClick={() => onSelectWorkspace(ws.id)}
                                    className={cn(
                                        "group relative flex items-center gap-3 px-4 py-3 rounded-lg border transition-all cursor-pointer",
                                        activeWorkspaceId === ws.id 
                                            ? "bg-zinc-900 border-zinc-700 shadow-lg shadow-zinc-900/50" 
                                            : "bg-zinc-900/30 border-zinc-800 hover:bg-zinc-900/50 hover:border-zinc-700",
                                        draggedIndex === index && "opacity-50",
                                        dragOverIndex === index && draggedIndex !== index && "bg-blue-500/10 border-blue-500"
                                    )}
                                >
                                    {/* Drag Handle */}
                                    <div className="flex-shrink-0 text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                                        <GripVertical className="w-4 h-4" />
                                    </div>

                                    {/* Workspace Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-white text-sm">{ws.name}</h3>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                                            <span className="font-mono">http://localhost:{ws.port}</span>
                                            <div className="flex items-center gap-1">
                                                <div className={cn(
                                                    "h-1.5 w-1.5 rounded-full",
                                                    ws.isRunning ? "bg-emerald-500" : "bg-zinc-700"
                                                )} />
                                                <span>{ws.isRunning ? "Running" : "Stopped"}</span>
                                            </div>
                                            <span className="text-zinc-600">•</span>
                                            <span>{ws.endpoints.length} endpoints</span>
                                            <span className="text-zinc-600">•</span>
                                            <span className="text-blue-400">{ws.endpoints.filter(e => e.enabled !== false).length} active</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {/* Status Indicator */}
                                        {ws.isRunning && (
                                            <div className="flex-shrink-0">
                                                <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                                            </div>
                                        )}
                                        
                                        {/* Actions Dropdown */}
                                        <div className="relative" ref={(el) => { dropdownRefs.current[ws.id] = el }}>
                                            <button
                                                onClick={(e) => toggleDropdown(e, ws.id)}
                                                className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-all"
                                                title="More actions"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                            
                                            {/* Dropdown Menu */}
                                            {openDropdownId === ws.id && (
                                                <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden">
                                                    <div className="py-1">
                                                        {/* Start/Stop */}
                                                        <button
                                                            onClick={(e) => handleToggleServer(e, ws.id)}
                                                            disabled={ws.endpoints.length === 0}
                                                            className={cn(
                                                                "w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors",
                                                                ws.isRunning
                                                                    ? "text-red-400 hover:bg-red-500/10"
                                                                    : "text-emerald-400 hover:bg-emerald-500/10",
                                                                ws.endpoints.length === 0 && "opacity-50 cursor-not-allowed"
                                                            )}
                                                        >
                                                            {ws.isRunning ? (
                                                                <>
                                                                    <Square className="w-4 h-4 fill-current" />
                                                                    <span>Stop Server</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Play className="w-4 h-4 fill-current" />
                                                                    <span>Start Server</span>
                                                                </>
                                                            )}
                                                        </button>
                                                        
                                                        {/* Divider */}
                                                        <div className="h-px bg-zinc-800 my-1" />
                                                        
                                                        {/* Duplicate */}
                                                        <button
                                                            onClick={(e) => handleDuplicate(e, ws.id)}
                                                            className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                            <span>Duplicate</span>
                                                        </button>
                                                        
                                                        {/* Delete */}
                                                        <button
                                                            onClick={(e) => handleDelete(e, ws)}
                                                            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            <span>Delete</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {workspaceToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={cancelDelete}>
                    <div 
                        className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold text-white mb-2">Delete Workspace</h3>
                        <p className="text-sm text-zinc-400 mb-6">
                            Are you sure you want to delete <span className="font-medium text-white">"{workspaceToDelete.name}"</span>? 
                            This action cannot be undone.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={cancelDelete}
                                className="px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

