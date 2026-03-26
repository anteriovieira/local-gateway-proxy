import React, { useState, useMemo, useEffect } from 'react'
import type { Workspace, MockDbConfig } from '../../types'
import { cn } from '@proxy-app/ui'
import { AlertCircle, Database, Power } from 'lucide-react'
import { JsonEditor } from '../JsonEditor'

interface MockDbPanelProps {
  workspace: Workspace
  onUpdate: (updates: Partial<Workspace>) => void
}

const DEFAULT_DATA = `{
  "users": [
    { "id": 1, "name": "John Doe", "email": "john@example.com" },
    { "id": 2, "name": "Jane Smith", "email": "jane@example.com" }
  ],
  "posts": [
    { "id": 1, "title": "Hello World", "userId": 1 },
    { "id": 2, "title": "Second Post", "userId": 2 }
  ]
}`

export const MockDbPanel: React.FC<MockDbPanelProps> = ({ workspace, onUpdate }) => {
  const config = workspace.mockDbConfig
  const isEnabled = !!config
  const [initialData, setInitialData] = useState(config?.initialData ?? '')

  // Sync local state when config changes externally (e.g. after CRUD operations)
  useEffect(() => {
    if (config?.initialData && config.initialData !== initialData) {
      setInitialData(config.initialData)
    }
  }, [config?.initialData])

  const jsonError = useMemo(() => {
    if (!initialData.trim()) return null
    try {
      const parsed = JSON.parse(initialData)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return 'Must be a JSON object with collection arrays'
      }
      for (const [key, val] of Object.entries(parsed)) {
        if (!Array.isArray(val)) {
          return `"${key}" must be an array`
        }
      }
      return null
    } catch (e: any) {
      return e.message
    }
  }, [initialData])

  const collections = useMemo(() => {
    if (!initialData.trim() || jsonError) return []
    try {
      const parsed = JSON.parse(initialData)
      return Object.entries(parsed).map(([name, data]) => ({
        name,
        count: (data as unknown[]).length,
      }))
    } catch {
      return []
    }
  }, [initialData, jsonError])

  const saveConfig = () => {
    if (jsonError && initialData.trim()) return
    const mockDbConfig: MockDbConfig | undefined = initialData.trim()
      ? { initialData }
      : undefined
    onUpdate({ mockDbConfig })
  }

  const hasChanges = initialData !== (config?.initialData ?? '')

  const handleToggle = () => {
    if (isEnabled) {
      // Disable — keep initialData in local state so it's preserved on re-enable
      onUpdate({ mockDbConfig: undefined })
    } else {
      // Enable — reuse whatever the user had, or fall back to defaults
      const data = initialData.trim() || DEFAULT_DATA
      setInitialData(data)
      onUpdate({ mockDbConfig: { initialData: data } })
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-medium text-zinc-300">Mock Database</span>
          {isEnabled && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && !jsonError && isEnabled && (
            <button
              onClick={saveConfig}
              className="px-2 py-1 text-[11px] font-medium rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 transition-colors"
            >
              Save Changes
            </button>
          )}
          <button
            onClick={handleToggle}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors",
              isEnabled
                ? "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400"
            )}
          >
            <Power className="w-3 h-3" />
            {isEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {!isEnabled ? (
        <div className="flex flex-col items-center justify-center text-zinc-600 p-8 flex-1">
          <Database className="w-8 h-8 mb-3 text-zinc-700" />
          <p className="text-sm">Mock Database is disabled</p>
          <p className="text-xs mt-1 text-center text-zinc-600">
            Enable to define collections and use them as response sources in mock endpoints.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-3 flex-1 min-h-0">
          {/* Info */}
          <div className="text-[11px] text-zinc-500 leading-relaxed">
            Define your collections below. Then in the <strong className="text-zinc-400">Mocks</strong> tab, choose <strong className="text-zinc-400">Mock DB</strong> as response source to associate an endpoint with a collection.
          </div>

          {/* Collections preview */}
          {collections.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Collections</label>
              <div className="flex flex-wrap gap-1.5">
                {collections.map(({ name, count }) => (
                  <div
                    key={name}
                    className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
                  >
                    <span className="text-[11px] text-zinc-300 font-mono">{name}</span>
                    <span className="text-[10px] text-zinc-500">{count} items</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* JSON editor */}
          <div className="flex-1 min-h-0 flex flex-col gap-1.5">
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider shrink-0">Data (db.json)</label>
            <div className="flex-1 min-h-0">
              <JsonEditor
                value={initialData}
                onChange={setInitialData}
              />
            </div>
            {jsonError && (
              <div className="flex items-center gap-1.5 text-[11px] text-red-400 shrink-0">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}
          </div>

          {/* Note about restart */}
          {hasChanges && workspace.isRunning && (
            <div className="text-[10px] text-amber-400/70">
              Restart the server to apply mock database changes.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
