import React, { useState } from 'react'
import { ArrowLeft, Settings, Pencil, Link2 } from 'lucide-react'
import { Workspace } from '../../types'
import { cn, Tabs, TabsList, TabsTrigger, TabsContent } from '@proxy-app/ui'

interface SettingsPageProps {
    workspace: Workspace | null
    onBack: () => void
    onUpdate: (updates: Partial<Workspace>) => void
}

const TAB_LABELS: Record<string, string> = {
    general: 'General',
    integration: 'Integration',
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ workspace, onBack, onUpdate }) => {
    const [activeTab, setActiveTab] = useState('general')
    const [editingName, setEditingName] = useState(false)

    const integrationProperty = workspace?.integrationProperty || 'x-amazon-apigateway-integration'
    const bypassUri = workspace?.bypassUri || ''

    if (!workspace) return null

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-950">
            <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="flex flex-1 min-h-0">
                {/* Left Sidebar Navigation */}
                <div className="w-56 border-r border-zinc-800 bg-zinc-950/50 flex flex-col shrink-0">
                    <div className="px-6 py-2.5 border-b border-zinc-800 flex items-center gap-2">
                        <button onClick={onBack} className="p-1.5 hover:bg-zinc-800 rounded transition-colors" title="Back">
                            <ArrowLeft className="w-4 h-4 text-zinc-400" />
                        </button>
                        <h2 className="text-lg font-semibold text-white">Settings</h2>
                    </div>
                    <TabsList variant="borderedVertical" className="w-full flex-1 justify-start mx-2 mt-2">
                        <TabsTrigger value="general" variant="borderedVertical" className="w-full justify-start gap-3">
                            <Settings className="w-4 h-4" />
                            General
                        </TabsTrigger>
                        <TabsTrigger value="integration" variant="borderedVertical" className="w-full justify-start gap-3">
                            <Link2 className="w-4 h-4" />
                            Integration
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Right Content Area */}
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-2 border-b border-zinc-800 shrink-0">
                        <h3 className="text-xl font-semibold text-white">
                            {TAB_LABELS[activeTab] ?? 'General'}
                        </h3>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="px-6 py-4">
                            <TabsContent value="general" className="mt-0">
                            <div className="space-y-0">
                                {/* Workspace Name */}
                                <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-zinc-300">Workspace Name</div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-1 justify-end">
                                        {editingName ? (
                                            <input
                                                type="text"
                                                value={workspace.name}
                                                onChange={(e) => onUpdate({ name: e.target.value })}
                                                onBlur={() => setEditingName(false)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        setEditingName(false)
                                                    }
                                                }}
                                                autoFocus
                                                className="px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-md text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 w-full max-w-xs"
                                            />
                                        ) : (
                                            <>
                                                <span className="text-sm text-zinc-400">{workspace.name}</span>
                                                <button
                                                    onClick={() => setEditingName(true)}
                                                    className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Port */}
                                <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-zinc-300">Port</div>
                                    </div>
                                    <div className="flex-1 flex justify-end">
                                        <input
                                            type="number"
                                            value={workspace.port}
                                            onChange={(e) => onUpdate({ port: parseInt(e.target.value) || 0 })}
                                            className="px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-md text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 w-24 text-right"
                                        />
                                    </div>
                                </div>

                                {/* Endpoints Summary */}
                                <div className="py-3 border-b border-zinc-800/50">
                                    <div className="text-sm font-medium text-zinc-300 mb-3">Endpoints</div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                                            <div className="text-xs text-zinc-500 mb-1">Total</div>
                                            <div className="text-lg font-semibold text-white">{workspace.endpoints.length}</div>
                                        </div>
                                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                                            <div className="text-xs text-zinc-500 mb-1">Enabled</div>
                                            <div className="text-lg font-semibold text-emerald-400">{workspace.endpoints.filter(e => e.enabled !== false).length}</div>
                                        </div>
                                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                                            <div className="text-xs text-zinc-500 mb-1">Disabled</div>
                                            <div className="text-lg font-semibold text-zinc-500">{workspace.endpoints.filter(e => e.enabled === false).length}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </TabsContent>

                            <TabsContent value="integration" className="mt-0">
                            <div className="space-y-0">
                                {/* Integration Property */}
                                <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-zinc-300">Integration Property</div>
                                        <div className="text-xs text-zinc-500 mt-0.5">
                                            Property name used to extract the URI from gateway configuration
                                        </div>
                                    </div>
                                    <div className="flex-1 flex justify-end">
                                        <input
                                            type="text"
                                            value={integrationProperty}
                                            onChange={(e) => onUpdate({ integrationProperty: e.target.value || 'x-amazon-apigateway-integration' })}
                                            className="px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-md text-sm text-white font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 w-full max-w-xs"
                                            placeholder="x-amazon-apigateway-integration"
                                        />
                                    </div>
                                </div>

                                {/* Bypass Setting */}
                                <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-zinc-300">Bypass Disabled Endpoints</div>
                                        <div className="text-xs text-zinc-500 mt-0.5">
                                            When enabled, requests to disabled endpoints will be redirected to the bypass URI. When disabled, requests will return 404.
                                        </div>
                                    </div>
                                    <div className="flex-1 flex justify-end">
                                        <button
                                            onClick={() => onUpdate({ bypassEnabled: !(workspace.bypassEnabled !== false) })}
                                            className={cn(
                                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900",
                                                workspace.bypassEnabled !== false ? "bg-blue-600" : "bg-zinc-700"
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                                    workspace.bypassEnabled !== false ? "translate-x-6" : "translate-x-1"
                                                )}
                                            />
                                        </button>
                                    </div>
                                </div>

                                {/* Bypass URI */}
                                <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-zinc-300">Bypass URI</div>
                                        <div className="text-xs text-zinc-500 mt-0.5">
                                            Base URL where disabled endpoints will be redirected. The request path will be appended (e.g., https://api.production.com/api)
                                        </div>
                                    </div>
                                    <div className="flex-1 flex justify-end">
                                        <input
                                            type="text"
                                            value={bypassUri}
                                            onChange={(e) => onUpdate({ bypassUri: e.target.value })}
                                            disabled={workspace.bypassEnabled === false}
                                            className={cn(
                                                "px-3 py-1.5 bg-zinc-950 border rounded-md text-sm font-mono focus:outline-none focus:ring-1 w-full max-w-xs",
                                                workspace.bypassEnabled !== false
                                                    ? "border-zinc-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                                    : "border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50"
                                            )}
                                            placeholder="https://api.production.com"
                                        />
                                    </div>
                                </div>
                            </div>
                            </TabsContent>
                        </div>
                    </div>
                </div>
            </Tabs>
        </div>
    )
}
