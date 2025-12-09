import React, { useRef, useEffect } from 'react'
import { LogEntry } from '../../types'
import { cn } from '../../utils'

interface TerminalProps {
    logs: LogEntry[]
}

export const Terminal: React.FC<TerminalProps> = ({ logs }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Scroll to bottom when new logs are added
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
        }
    }, [logs])

    if (logs.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-zinc-700 font-mono text-xs">
                _ waiting for traffic...
            </div>
        )
    }

    return (
        <div 
            ref={scrollContainerRef}
            className="h-full overflow-y-auto font-mono text-xs space-y-1 p-1"
        >
            {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                    <span className="text-zinc-600 select-none">[{log.timestamp}]</span>
                    <span className={cn(
                        log.type === 'error' ? 'text-red-400' :
                            log.type === 'success' ? 'text-emerald-400' : 'text-zinc-300'
                    )}>
                        {log.message}
                    </span>
                </div>
            ))}
        </div>
    )
}
