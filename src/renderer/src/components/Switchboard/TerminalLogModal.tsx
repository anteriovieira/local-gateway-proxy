import React from 'react'
import { X } from 'lucide-react'
import { LogEntry } from '../../types'
import { Terminal } from './Terminal'
import { cn } from '../../utils'

interface TerminalLogModalProps {
    isOpen: boolean
    onClose: () => void
    logs: LogEntry[]
}

export const TerminalLogModal: React.FC<TerminalLogModalProps> = ({ 
    isOpen, 
    onClose, 
    logs 
}) => {
    if (!isOpen) return null

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-6xl h-[80vh] overflow-hidden flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
                    <h2 className="text-lg font-semibold text-white">Terminal Log</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>

                {/* Terminal Content */}
                <div className="flex-1 overflow-hidden bg-black">
                    <Terminal logs={logs} />
                </div>
            </div>
        </div>
    )
}
