import React from 'react'
import { X } from 'lucide-react'

interface PanelWrapperProps {
  title: string
  children: React.ReactNode
  onClose: () => void
}

export const PanelWrapper: React.FC<PanelWrapperProps> = ({ children, onClose }) => {
  return (
    <div className="relative flex flex-col h-full min-h-0 overflow-hidden group/panel">
      <button
        onClick={onClose}
        className="absolute top-1.5 right-10 z-10 p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-colors opacity-0 group-hover/panel:opacity-100"
        title="Close"
      >
        <X className="w-3 h-3" />
      </button>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  )
}
