import React from 'react'
import { X } from 'lucide-react'
import type { LogEntry } from '@proxy-app/shared'
import { Terminal } from './Terminal'

interface TerminalLogModalProps {
  isOpen: boolean
  onClose: () => void
  logs: LogEntry[]
}

export const TerminalLogModal: React.FC<TerminalLogModalProps> = ({ isOpen, onClose, logs }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm" onClick={onClose}>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-300">Terminal Log</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded transition-colors" title="Close">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden bg-black">
          <Terminal logs={logs} />
        </div>
      </div>
    </div>
  )
}
