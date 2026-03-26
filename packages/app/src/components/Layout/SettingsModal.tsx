import React, { useState } from 'react'
import { Pencil } from 'lucide-react'
import type { Workspace } from '../../types'
import { cn, Tabs, TabsList, TabsTrigger, TabsContent } from '@proxy-app/ui'

interface SettingsPageProps {
  workspace: Workspace | null
  onUpdate: (updates: Partial<Workspace>) => void
  variant?: 'desktop' | 'extension'
}

type TabType = 'general' | 'integration' | 'capture'

export const SettingsPage: React.FC<SettingsPageProps> = ({ workspace, onUpdate, variant = 'desktop' }) => {
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [editingName, setEditingName] = useState(false)

  const integrationProperty = workspace?.integrationProperty || 'x-amazon-apigateway-integration'
  const bypassUri = workspace?.bypassUri || ''

  if (!workspace) return null

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-950">
      <div className="flex flex-row justify-between items-center p-3 border-b border-zinc-900 bg-zinc-900/30 shrink-0">
        <span className="text-xs font-medium text-zinc-400">Settings</span>
      </div>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TabsList variant="pill" className="justify-start gap-1 px-3 py-1.5 border-b border-zinc-900 shrink-0">
          <TabsTrigger value="general" variant="pill" className="text-xs px-2.5 py-1">
            General
          </TabsTrigger>
          <TabsTrigger value="integration" variant="pill" className="text-xs px-2.5 py-1">
            Integration
          </TabsTrigger>
          {variant === 'extension' && (
            <TabsTrigger value="capture" variant="pill" className="text-xs px-2.5 py-1">
              Capture
            </TabsTrigger>
          )}
        </TabsList>
        <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-4 sm:px-6 py-4">
            <TabsContent value="general" className="mt-0">
              <div className="space-y-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-zinc-800/50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-300">Workspace Name</div>
                  </div>
                  <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                    {editingName ? (
                      <input
                        type="text"
                        value={workspace.name}
                        onChange={(e) => onUpdate({ name: e.target.value })}
                        onBlur={() => setEditingName(false)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
                        autoFocus
                        className="px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-md text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 w-full max-w-xs"
                      />
                    ) : (
                      <>
                        <span className="text-sm text-zinc-400">{workspace.name}</span>
                        <button onClick={() => setEditingName(true)} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {variant === 'desktop' && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-zinc-800/50">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-300">Port</div>
                    </div>
                    <div className="flex-1 flex justify-end min-w-0">
                      <input
                        type="number"
                        value={workspace.port}
                        onChange={(e) => onUpdate({ port: parseInt(e.target.value) || 0 })}
                        className="px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-md text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 w-24 text-right"
                      />
                    </div>
                  </div>
                )}
                <div className="py-3 border-b border-zinc-800/50">
                  <div className="text-sm font-medium text-zinc-300 mb-3">Endpoints</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                      <div className="text-xs text-zinc-500 mb-1">Total</div>
                      <div className="text-base font-semibold text-white">{workspace.endpoints.length}</div>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                      <div className="text-xs text-zinc-500 mb-1">Enabled</div>
                      <div className="text-base font-semibold text-emerald-400">{workspace.endpoints.filter((e) => e.enabled !== false).length}</div>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                      <div className="text-xs text-zinc-500 mb-1">Disabled</div>
                      <div className="text-base font-semibold text-zinc-500">{workspace.endpoints.filter((e) => e.enabled === false).length}</div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="capture" className="mt-0">
              <div className="space-y-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-zinc-800/50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-300">Incoming requests URL must contain</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Only capture requests whose URL contains this text. Leave empty to capture all.</div>
                  </div>
                  <div className="flex-1 flex justify-end min-w-0">
                    <input
                      type="text"
                      value={workspace.urlMustContain ?? ''}
                      onChange={(e) => onUpdate({ urlMustContain: e.target.value || undefined })}
                      className="px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-md text-sm text-white font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 w-full min-w-0 max-w-xs"
                      placeholder="e.g. api.example.com or /v1/"
                    />
                  </div>
                </div>
                <div className="py-3 border-b border-zinc-800/50">
                  <div className="text-sm font-medium text-zinc-300 mb-2">Capture Resource Types</div>
                  <div className="text-xs text-zinc-500 mb-3">Select which request types to capture. Default: API calls (fetch/XHR) only. Restart recording to apply changes.</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'xmlhttprequest', label: 'API (fetch/XHR)' },
                      { id: 'main_frame', label: 'Main frame' },
                      { id: 'sub_frame', label: 'Sub frame' },
                      { id: 'script', label: 'Script' },
                      { id: 'stylesheet', label: 'Stylesheet' },
                      { id: 'image', label: 'Image' },
                      { id: 'font', label: 'Font' },
                      { id: 'media', label: 'Media' },
                      { id: 'websocket', label: 'WebSocket' },
                      { id: 'other', label: 'Other' },
                    ].map(({ id, label }) => {
                      const types = workspace.captureResourceTypes ?? ['xmlhttprequest']
                      const isChecked = types.includes(id)
                      return (
                        <label
                          key={id}
                          className={cn(
                            "inline-flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-md border cursor-pointer transition-colors",
                            isChecked ? "bg-blue-500/10 border-blue-500/30 text-blue-300" : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const newTypes = e.target.checked
                                ? [...(workspace.captureResourceTypes ?? ['xmlhttprequest']), id]
                                : (workspace.captureResourceTypes ?? ['xmlhttprequest']).filter((t) => t !== id)
                              onUpdate({ captureResourceTypes: newTypes.length > 0 ? newTypes : ['xmlhttprequest'] })
                            }}
                            className="sr-only"
                          />
                          <span className="text-xs font-medium">{label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="integration" className="mt-0">
              <div className="space-y-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-zinc-800/50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-300">Integration Property</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Property name used to extract the URI from gateway configuration</div>
                  </div>
                  <div className="flex-1 flex justify-end min-w-0">
                    <input
                      type="text"
                      value={integrationProperty}
                      onChange={(e) => onUpdate({ integrationProperty: e.target.value || 'x-amazon-apigateway-integration' })}
                      className="px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-md text-sm text-white font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 w-full min-w-0 max-w-xs"
                      placeholder="x-amazon-apigateway-integration"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-zinc-800/50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-300">Bypass Disabled Endpoints</div>
                    <div className="text-xs text-zinc-500 mt-0.5">When enabled, requests to disabled endpoints will be redirected to the bypass URI. When disabled, requests will return 404.</div>
                  </div>
                  <div className="flex-1 flex justify-end">
                    <button
                      onClick={() => onUpdate({ bypassEnabled: !(workspace.bypassEnabled !== false) })}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900",
                        workspace.bypassEnabled !== false ? "bg-blue-600" : "bg-zinc-700"
                      )}
                    >
                      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", workspace.bypassEnabled !== false ? "translate-x-6" : "translate-x-1")} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-zinc-800/50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-300">Bypass URI</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Base URL where disabled endpoints will be redirected. The request path will be appended (e.g., https://api.production.com/api)</div>
                  </div>
                  <div className="flex-1 flex justify-end min-w-0">
                    <input
                      type="text"
                      value={bypassUri}
                      onChange={(e) => onUpdate({ bypassUri: e.target.value })}
                      disabled={workspace.bypassEnabled === false}
                      className={cn(
                        "px-3 py-1.5 bg-zinc-950 border rounded-md text-sm font-mono focus:outline-none focus:ring-1 w-full min-w-0 max-w-xs",
                        workspace.bypassEnabled !== false ? "border-zinc-700 text-white focus:border-blue-500 focus:ring-blue-500/20" : "border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50"
                      )}
                      placeholder="https://api.production.com"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
  )
}
