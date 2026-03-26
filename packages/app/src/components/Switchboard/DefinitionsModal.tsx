import React, { useState } from 'react'
import { X, Variable, Code, Check } from 'lucide-react'
import { JsonEditor } from '../JsonEditor'
import type { Workspace } from '../../types'
import { cn, Tabs, TabsList, TabsTrigger, TabsContent } from '@proxy-app/ui'

interface DefinitionsModalProps {
  workspace: Workspace | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (updates: Partial<Workspace>) => void
  isRunning?: boolean
  onToggleServer?: () => void
  onRestartServer?: () => void
}

export const DefinitionsModal: React.FC<DefinitionsModalProps> = ({
  workspace,
  isOpen,
  onClose,
  onUpdate,
  isRunning = false,
  onToggleServer,
  onRestartServer,
}) => {
  const [isApplying, setIsApplying] = useState(false)
  const [localWorkspace, setLocalWorkspace] = useState<Workspace | null>(workspace)

  React.useEffect(() => {
    if (workspace) setLocalWorkspace(workspace)
  }, [workspace])

  if (!isOpen || !workspace || !localWorkspace) return null

  const handleApply = async () => {
    setIsApplying(true)
    try {
      onUpdate({ configContent: localWorkspace.configContent, variables: localWorkspace.variables })
      if (isRunning && onRestartServer) {
        await onRestartServer()
      } else if (isRunning && onToggleServer) {
        await onToggleServer()
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await onToggleServer()
      }
      setIsApplying(false)
      onClose()
    } catch (error) {
      console.error('Failed to apply changes:', error)
      setIsApplying(false)
    }
  }

  const handleConfigChange = (code: string) => {
    setLocalWorkspace({ ...localWorkspace, configContent: code })
    onUpdate({ configContent: code })
  }

  const handleVariableChange = (key: string, value: string) => {
    const newVars = { ...localWorkspace.variables, [key]: value }
    setLocalWorkspace({ ...localWorkspace, variables: newVars })
    onUpdate({ variables: newVars })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-sm" onClick={onClose}>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-950" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-900 bg-zinc-900/30 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-300">Definitions</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded transition-colors" title="Close">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        <Tabs defaultValue="spec" className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList variant="pill" className="justify-start gap-2 px-4 sm:px-6 py-2 border-b border-zinc-900 bg-zinc-900/30 shrink-0">
            <TabsTrigger value="spec" variant="pill" className="gap-2">
              <Code className="w-4 h-4" />
              Spec
            </TabsTrigger>
            <TabsTrigger value="variables" variant="pill" className="gap-2">
              <Variable className="w-4 h-4" />
              Variables
            </TabsTrigger>
          </TabsList>
          <TabsContent value="spec" className="flex-1 min-h-0 mt-0 overflow-hidden">
            <JsonEditor
              value={localWorkspace.configContent}
              onChange={handleConfigChange}
            />
          </TabsContent>
          <TabsContent value="variables" className="flex-1 min-h-0 mt-0 overflow-y-auto">
            <div className="p-6">
              {Object.keys(localWorkspace.variables).length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-sm">No variables configured</div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(localWorkspace.variables).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-2">
                      <label className="text-xs text-zinc-400 font-mono">{key}</label>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => handleVariableChange(key, e.target.value)}
                        className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-white font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 w-full"
                        placeholder="Enter value..."
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        <div className="flex items-center justify-end gap-3 px-4 py-2 border-t border-zinc-900 shrink-0 bg-zinc-900/30">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors">
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={isApplying}
            className={cn(
              "px-4 py-2 text-sm font-medium text-white rounded-md transition-colors flex items-center gap-2",
              isApplying ? "bg-blue-600/50 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            )}
          >
            {isApplying ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Apply {isRunning ? '& Reload Server' : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
