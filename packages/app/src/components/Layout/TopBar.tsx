import React, { useRef, useEffect, useState } from 'react'
import { ChevronsUpDown, Play, Square, RotateCw, Settings, Plus, List, FolderKanban, Check } from 'lucide-react'
import { cn, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@proxy-app/ui'
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
  onRestartServer?: () => void
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
  onRestartServer,
  onUpdateWorkspace,
  onSettings,
  onAddWorkspace,
  onOpenEndpoints,
  nativeWindowDrag = false,
  variant = 'desktop',
}) => {
  const [elapsedMs, setElapsedMs] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

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

  return (
    <div
      className="h-10 bg-zinc-900 flex items-center justify-between shrink-0 relative z-50"
      style={{
        ...(nativeWindowDrag && { WebkitAppRegion: 'drag' as React.CSSProperties['WebkitAppRegion'] }),
        paddingLeft: nativeWindowDrag && isMac ? '80px' : '16px',
        paddingRight: '16px',
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-2" style={nativeWindowDrag ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors text-xs hover:bg-zinc-800 text-zinc-300 font-medium">
              <span>{workspaceName ?? 'Workspaces'}</span>
              <ChevronsUpDown className="w-3 h-3 text-zinc-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {workspaceName && onHome && (
              <>
                <DropdownMenuItem onClick={onHome} className="text-zinc-300">
                  <FolderKanban className="w-4 h-4 text-zinc-400" />
                  <span className="font-medium">Manage Workspaces</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {workspaces.length === 0 ? (
              <div className="px-3 py-2 text-sm text-zinc-500 text-center">No workspaces</div>
            ) : (
              workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => onSelectWorkspace?.(ws.id)}
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
                  {activeWorkspaceId === ws.id && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                </DropdownMenuItem>
              ))
            )}
            {onAddWorkspace && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onAddWorkspace} className="text-zinc-300">
                  <Plus className="w-4 h-4 text-zinc-400" />
                  <span className="font-medium">New Workspace</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
            {workspace.isRunning && (
              <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                {formatElapsed(elapsedMs)}
              </span>
            )}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => !workspace.isRunning && onToggleServer?.()}
                disabled={workspace.isRunning || (variant === 'desktop' && !workspace.endpoints.length)}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  workspace.isRunning || (variant === 'desktop' && !workspace.endpoints.length)
                    ? "text-zinc-600 cursor-default"
                    : "text-emerald-400 hover:bg-zinc-800 hover:text-emerald-300"
                )}
                title="Start"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => workspace.isRunning && onToggleServer?.()}
                disabled={!workspace.isRunning}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  workspace.isRunning
                    ? "text-red-400 hover:bg-zinc-800 hover:text-red-300"
                    : "text-zinc-600 cursor-default"
                )}
                title="Stop"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => workspace.isRunning && onRestartServer?.()}
                disabled={!workspace.isRunning}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  workspace.isRunning
                    ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    : "text-zinc-600 cursor-default"
                )}
                title="Restart"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
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
