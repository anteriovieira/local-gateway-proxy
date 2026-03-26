import React from 'react'
import { Terminal } from 'lucide-react'
import { cn } from '@proxy-app/ui'

interface FooterAction {
  id: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
}

interface FooterProps {
  actions: FooterAction[]
  variant?: 'desktop' | 'extension'
}

export const Footer: React.FC<FooterProps> = ({ actions, variant = 'desktop' }) => {
  return (
    <div className="h-8 shrink-0 flex items-center gap-0.5 px-2 border-t border-zinc-900 bg-zinc-900/30">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={action.onClick}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-t text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors",
            action.active && "bg-zinc-800/80 text-zinc-200"
          )}
          title={action.label}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  )
}
