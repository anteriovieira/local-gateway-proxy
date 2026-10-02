import React, { useState } from 'react'
import { X, Variable, Code, Check, FilePlus } from 'lucide-react'
import { JsonEditor } from '../JsonEditor'
import { buildDefinitionTemplate } from '../../utils/definitionTemplate'
import type { Workspace } from '../../types'
import { cn, CopyButton, Tabs, TabsList, TabsTrigger, TabsContent } from '@proxy-app/ui'

interface DefinitionsModalProps {
  workspace: Workspace | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (updates: Partial<Workspace>) => void
  isRunning?: boolean
  onToggleServer?: () => void
  onRestartServer?: () => void
  /** When true, renders inline without modal overlay (for docked panel use) */
  embedded?: boolean
}

export const DefinitionsModal: React.FC<DefinitionsModalProps> = ({
  workspace,
  isOpen,
  onClose,
  onUpdate,
  isRunning = false,
  onToggleServer,
  onRestartServer,
  embedded = false,
}) => {
  const [isApplying, setIsApplying] = useState(false)
  const [localWorkspace, setLocalWorkspace] = useState<Workspace | null>(workspace)

  React.useEffect(() => {
    if (workspace) setLocalWorkspace(workspace)
  }, [workspace])

  if (!workspace || !localWorkspace) return null
  if (!embedded && !isOpen) return null

  // Safe reference after null checks above
  const ws = localWorkspace

  const handleApply = async () => {
    setIsApplying(true)
    try {
      onUpdate({ configContent: ws.configContent, variables: ws.variables })
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
    setLocalWorkspace({ ...ws, configContent: code })
    onUpdate({ configContent: code })
  }

  const handleVariableChange = (key: string, value: string) => {
    const newVars = { ...ws.variables, [key]: value }
    setLocalWorkspace({ ...ws, variables: newVars })
    onUpdate({ variables: newVars })
  }

  const content = (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-950">
      {!embedded && (
        <div className="flex flex-row justify-between items-center h-10 px-3 border-b border-zinc-900 bg-zinc-900/30 shrink-0">
          <span className="text-xs font-medium text-zinc-400">Definitions</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleApply}
              disabled={isApplying}
              className={cn(
                "px-3 py-1 text-xs bg-zinc-900 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-300 flex items-center gap-1.5 transition-colors whitespace-nowrap",
                isApplying && "opacity-50 cursor-not-allowed"
              )}
            >
              {isApplying ? (
                <>
                  <div className="w-3 h-3 border-2 border-zinc-500/30 border-t-zinc-300 rounded-full animate-spin" />
                  <span>Applying...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply{isRunning ? ' & Reload' : ''}</span>
                </>
              )}
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded transition-colors" title="Close">
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>
      )}
      <Tabs defaultValue="spec" className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-900 shrink-0">
          <TabsList variant="segmented">
            <TabsTrigger value="spec" variant="segmented">
              <Code className="w-3.5 h-3.5" />
              Spec
            </TabsTrigger>
            <TabsTrigger value="variables" variant="segmented">
              <Variable className="w-3.5 h-3.5" />
              Variables
            </TabsTrigger>
          </TabsList>
          {ws.configContent?.trim() && (
            <CopyButton text={ws.configContent} iconSize="w-3.5 h-3.5" className="shrink-0" title="Copy spec" />
          )}
        </div>
        <TabsContent value="spec" className="flex-1 min-h-0 mt-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0">
            <JsonEditor
              value={ws.configContent}
              onChange={handleConfigChange}
            />
          </div>
          {!ws.configContent?.trim() && (
            <div className="flex justify-center py-2 shrink-0">
              <button
                onClick={() => handleConfigChange(buildDefinitionTemplate(ws.integrationProperty))}
                className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 rounded-md hover:bg-zinc-900 transition-colors"
              >
                <FilePlus className="w-3.5 h-3.5" />
                Use example template
              </button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="variables" className="flex-1 min-h-0 mt-0 overflow-y-auto">
          <div className="p-6">
            {Object.keys(ws.variables).length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-sm">No variables configured</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(ws.variables).map(([key, value]) => (
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
      {embedded && (
        <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-t border-zinc-900 shrink-0 bg-zinc-900/30">
          <button
            onClick={handleApply}
            disabled={isApplying}
            className={cn(
              "px-3 py-1 text-xs bg-zinc-900 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-300 flex items-center gap-1.5 transition-colors whitespace-nowrap",
              isApplying && "opacity-50 cursor-not-allowed"
            )}
          >
            {isApplying ? (
              <>
                <div className="w-3 h-3 border-2 border-zinc-500/30 border-t-zinc-300 rounded-full animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Apply{isRunning ? ' & Reload' : ''}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )

  if (embedded) return content

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-sm" onClick={onClose}>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  )
}
