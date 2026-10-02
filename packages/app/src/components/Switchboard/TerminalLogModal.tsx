import React from 'react'
import type { LogEntry } from '@proxy-app/shared'
import { CopyButton } from '@proxy-app/ui'
import { Terminal } from './Terminal'

interface TerminalPageProps {
  logs: LogEntry[]
}

export const TerminalPage: React.FC<TerminalPageProps> = ({ logs }) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-950">
      <div className="flex flex-row justify-between items-center h-10 px-3 border-b border-zinc-900 bg-zinc-900/30 shrink-0">
        <span className="text-xs font-medium text-zinc-400">Terminal</span>
        {logs.length > 0 && (
          <CopyButton
            text={logs.map((log) => `[${log.timestamp}] ${log.message}`).join('\n')}
            iconSize="w-3.5 h-3.5"
            title="Copy terminal logs"
          />
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden bg-zinc-950">
        <Terminal logs={logs} />
      </div>
    </div>
  )
}
