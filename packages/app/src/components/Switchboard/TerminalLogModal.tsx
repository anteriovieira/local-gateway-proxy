import React from 'react'
import { ArrowLeft } from 'lucide-react'
import type { LogEntry } from '@proxy-app/shared'
import { Terminal } from './Terminal'

interface TerminalPageProps {
  onBack: () => void
  logs: LogEntry[]
}

export const TerminalPage: React.FC<TerminalPageProps> = ({ onBack, logs }) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-900 bg-zinc-900/30 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1.5 hover:bg-zinc-800 rounded transition-colors" title="Back">
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
          <h2 className="text-sm font-semibold text-zinc-300">Terminal Log</h2>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden bg-zinc-950">
        <Terminal logs={logs} />
      </div>
    </div>
  )
}
