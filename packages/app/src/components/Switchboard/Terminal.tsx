import React, { useRef, useEffect } from 'react'
import type { LogEntry } from '@proxy-app/shared'
import { cn } from '@proxy-app/ui'

interface TerminalProps {
  logs: LogEntry[]
}

export const Terminal: React.FC<TerminalProps> = ({ logs }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [logs])

  if (logs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-3 text-zinc-600 font-mono text-xs">
        _ waiting for traffic...
      </div>
    )
  }

  return (
    <div ref={scrollContainerRef} className="h-full overflow-y-auto font-mono text-xs space-y-1 p-3">
      {logs.map((log, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-zinc-600 select-none">[{log.timestamp}]</span>
          <span className={cn(log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-zinc-300')}>
            {log.message}
          </span>
        </div>
      ))}
    </div>
  )
}
