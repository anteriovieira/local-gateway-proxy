import React, { useState, useRef, useEffect } from 'react'
import { ChevronsUpDownIcon, Play, Square, Settings, Plus, List, FolderKanban } from 'lucide-react'
import { cn } from '@proxy-app/ui'
import type { Workspace } from '../../types'

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((n) => n.toString().padStart(2, '0')).join(' : ')
}

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
  onAddWorkspace?: () => void
  onOpenEndpoints?: () => void
  /** When true, use native window drag region (Electron). When false, normal layout (extension). */
  nativeWindowDrag?: boolean
  variant?: 'desktop' | 'extension'
}

export const TopBar: React.FC<TopBarProps> = ({
  workspaces,
  activeWorkspaceId,
  workspaceName,
  workspace,
  onHome,
  onSelectWorkspace,
  onToggleServer,
  onUpdateWorkspace,
  onSettings,
  onAddWorkspace,
  onOpenEndpoints,
  nativeWindowDrag = false,
  variant = 'desktop',
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

  // Track elapsed time when server is running
  useEffect(() => {
    if (workspace?.isRunning) {
      if (!startTimeRef.current) startTimeRef.current = Date.now()
      const tick = () => setElapsedMs(Date.now() - (startTimeRef.current ?? Date.now()))
      tick()
      const id = setInterval(tick, 1000)
      return () => clearInterval(id)
    } else {
      startTimeRef.current = null
      setElapsedMs(0)
    }
  }, [workspace?.isRunning])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDropdownOpen])

  return (
    <div
      className="h-10 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800 flex items-center justify-between shrink-0 relative z-50"
      style={{
        ...(nativeWindowDrag && { WebkitAppRegion: 'drag' as React.CSSProperties['WebkitAppRegion'] }),
        paddingLeft: nativeWindowDrag && isMac ? '80px' : '16px',
        paddingRight: '16px',
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-2" style={nativeWindowDrag ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}>
        <div className="relative" ref={dropdownRef}>
          <button
            ref={buttonRef}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors text-sm hover:bg-zinc-800 text-white font-medium"
          >
            <span>{workspaceName ?? 'Workspaces'}</span>
            <ChevronsUpDownIcon className="w-3 text-zinc-500" />
          </button>
          {isDropdownOpen && buttonRef.current && (
            <div
              className="fixed bg-zinc-900 border border-zinc-800 rounded-md shadow-2xl z-[9999] max-h-96 overflow-y-auto"
              style={{
                top: `${buttonRef.current.getBoundingClientRect().bottom + 4}px`,
                left: `${buttonRef.current.getBoundingClientRect().left}px`,
                width: '256px',
              }}
            >
              <div className="p-2">
                {workspaceName && onHome && (
                  <>
                    <button
                      onClick={() => { onHome(); setIsDropdownOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    >
                      <FolderKanban className="w-4 h-4 text-zinc-400" />
                      <span className="font-medium">Manage Workspaces</span>
                    </button>
                    <div className="border-t border-zinc-800 my-2" />
                  </>
                )}
                {workspaces.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-zinc-500 text-center">No workspaces</div>
                ) : (
                  workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => { onSelectWorkspace?.(ws.id); setIsDropdownOpen(false) }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors",
                        activeWorkspaceId === ws.id ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      )}
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
                      {activeWorkspaceId === ws.id && (
                        <div className="ml-2 flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        </div>
                      )}
                    </button>
                  ))
                )}
                {onAddWorkspace && (
                  <>
                    <div className="border-t border-zinc-800 my-2" />
                    <button
                      onClick={() => { onAddWorkspace(); setIsDropdownOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    >
                      <Plus className="w-4 h-4 text-zinc-400" />
                      <span className="font-medium">Create New Workspace</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3" style={nativeWindowDrag ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}>
        {workspace && (
          <>
            {variant === 'desktop' && (
              <div className="flex items-center gap-2 text-zinc-500 bg-zinc-900/50 px-2.5 py-1 rounded border border-zinc-800">
                <span className="text-[10px] font-mono">Port</span>
                <input
                  type="number"
                  value={workspace.port}
                  onChange={(e) => onUpdateWorkspace?.({ port: parseInt(e.target.value) || 0 })}
                  className="bg-transparent w-14 text-xs font-mono text-zinc-200 focus:outline-none text-center"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              {workspace.isRunning ? (
                <>
                  <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                    {formatElapsed(elapsedMs)}
                  </span>
                  <div className="w-px h-3.5 bg-zinc-700" />
                  <button
                    onClick={onToggleServer}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium bg-red-500/40 hover:bg-red-500/60 text-white transition-colors"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={onToggleServer}
                  disabled={variant === 'desktop' && !workspace.endpoints.length}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                    "bg-emerald-500/40 hover:bg-emerald-500/60 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Start</span>
                </button>
              )}
            </div>
            {onOpenEndpoints && (
              <button onClick={onOpenEndpoints} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors" title="Endpoints">
                <List className="w-4 h-4" />
              </button>
            )}
            <button onClick={onSettings} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors" title="Settings">
              <Settings className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
