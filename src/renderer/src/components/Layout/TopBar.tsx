import React, { useState, useRef, useEffect } from 'react'
import { ChevronsUpDownIcon, Play, Square, Settings } from 'lucide-react'
import { cn } from '../../utils'
import { Workspace } from '../../types'

interface TopBarProps {
    workspaces: Workspace[]
    activeWorkspaceId: string | null
    workspaceName?: string
    workspace?: Workspace | null
    onHome?: () => void
    onSelectWorkspace?: (id: string) => void
    onToggleServer?: () => void
    onUpdateWorkspace?: (updates: Partial<Workspace>) => void
    onSearch?: () => void
    onSettings?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({ workspaces, activeWorkspaceId, workspaceName, workspace, onHome, onSelectWorkspace, onToggleServer, onUpdateWorkspace, onSearch, onSettings }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isDropdownOpen])

    return (
        <div
            className="h-10 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800 flex items-center justify-between shrink-0 relative z-50"
            style={{
                WebkitAppRegion: 'drag',
                paddingLeft: isMac ? '80px' : '16px',
                paddingRight: '16px'
            } as React.CSSProperties}
        >
            {/* Left Section: Navigation */}
            <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                {/* Workspaces Button */}
                <button
                    onClick={onHome}
                    className="px-3 py-1.5 rounded-md transition-colors text-sm hover:bg-zinc-800 text-zinc-300"
                >
                    Workspaces
                </button>

                {/* Workspace Name Dropdown */}
                {workspaceName && (
                    <div className="relative" ref={dropdownRef}>
                        <button
                            ref={buttonRef}
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors text-sm hover:bg-zinc-800 text-white font-medium"
                        >
                            <span>{workspaceName}</span>
                            <ChevronsUpDownIcon className="w-3 h-3 text-zinc-500" />
                        </button>

                        {/* Dropdown Menu */}
                        {isDropdownOpen && buttonRef.current && (
                            <div
                                className="fixed bg-zinc-900 border border-zinc-800 rounded-md shadow-2xl z-[9999] max-h-96 overflow-y-auto"
                                style={{
                                    top: `${buttonRef.current.getBoundingClientRect().bottom + 4}px`,
                                    left: `${buttonRef.current.getBoundingClientRect().left}px`,
                                    width: '256px'
                                }}
                            >
                                <div className="p-2">
                                    {workspaces.length === 0 ? (
                                        <div className="px-3 py-2 text-sm text-zinc-500 text-center">
                                            No workspaces
                                        </div>
                                    ) : (
                                        workspaces.map((ws) => (
                                            <button
                                                key={ws.id}
                                                onClick={() => {
                                                    onSelectWorkspace?.(ws.id)
                                                    setIsDropdownOpen(false)
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors",
                                                    activeWorkspaceId === ws.id
                                                        ? "bg-zinc-800 text-white"
                                                        : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                                                )}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">{ws.name}</div>
                                                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                                                        <span className="font-mono">PORT: {ws.port}</span>
                                                        <div className="flex items-center gap-1">
                                                            <div className={cn(
                                                                "h-1.5 w-1.5 rounded-full",
                                                                ws.isRunning ? "bg-emerald-500" : "bg-zinc-700"
                                                            )} />
                                                            <span>{ws.isRunning ? "Running" : "Stopped"}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {activeWorkspaceId === ws.id && (
                                                    <div className="ml-2 flex-shrink-0">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                    </div>
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Right Section: Actions */}
            <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                {workspace && (
                    <>
                        {/* Server Status */}
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                workspace.isRunning ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-zinc-700"
                            )} />
                            <span className="font-medium">{workspace.isRunning ? "ONLINE" : "OFFLINE"}</span>
                        </div>

                        {/* Port Field */}
                        <div className="flex items-center gap-2 text-zinc-500 bg-zinc-900/50 px-2.5 py-1 rounded border border-zinc-800">
                            <span className="text-[10px] font-mono uppercase">Port</span>
                            <input
                                type="number"
                                value={workspace.port}
                                onChange={(e) => onUpdateWorkspace?.({ port: parseInt(e.target.value) || 0 })}
                                className="bg-transparent w-14 text-xs font-mono text-zinc-200 focus:outline-none text-center"
                            />
                        </div>


                        {/* Start/Stop Server Button */}
                        <button
                            onClick={onToggleServer}
                            disabled={!workspace.endpoints.length}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
                                workspace.isRunning
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                                    : "bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            {workspace.isRunning ? (
                                <>
                                    <Square className="w-3 h-3 fill-current" />
                                    <span>Stop</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-3 h-3 fill-current" />
                                    <span>Start</span>
                                </>
                            )}
                        </button>

                        {/* Settings Button */}
                        <button
                            onClick={onSettings}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                            title="Settings"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

