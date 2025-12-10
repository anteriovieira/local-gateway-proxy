import React, { useState } from 'react'
import { X, Settings, Pencil, Link2 } from 'lucide-react'
import { Workspace } from '../../types'
import { cn } from '../../utils'

interface SettingsModalProps {
    workspace: Workspace | null
    isOpen: boolean
    onClose: () => void
    onUpdate: (updates: Partial<Workspace>) => void
}

type TabType = 'general' | 'integration'

interface TabItem {
    id: TabType
    label: string
    icon: React.ReactNode
}

const tabs: TabItem[] = [
    { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { id: 'integration', label: 'Integration', icon: <Link2 className="w-4 h-4" /> },
]


export const SettingsModal: React.FC<SettingsModalProps> = ({ workspace, isOpen, onClose, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<TabType>('general')
    const [editingName, setEditingName] = useState(false)
    
    const integrationProperty = workspace?.integrationProperty || 'x-amazon-apigateway-integration'
    const bypassUri = workspace?.bypassUri || ''
    
    if (!isOpen || !workspace) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-4xl h-[600px] overflow-hidden flex shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Left Sidebar Navigation */}
                <div className="w-56 border-r border-zinc-800 bg-zinc-950/50 flex flex-col">
                    <div className="px-6 py-2.5 border-b border-zinc-800">
                        <h2 className="text-lg font-semibold text-white">Settings</h2>
                    </div>
                    <div className="flex-1 py-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors",
                                    activeTab === tab.id
                                        ? "bg-zinc-800 text-white"
                                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300"
                                )}
                            >
                                <span className={cn(
                                    activeTab === tab.id ? "text-white" : "text-zinc-500"
                                )}>
                                    {tab.icon}
                                </span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right Content Area */}
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-2 border-b border-zinc-800">
                        <h3 className="text-xl font-semibold text-white">
                            {tabs.find(t => t.id === activeTab)?.label}
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto min-h-[500px]">
                        <div className="px-6 py-4">
                            {activeTab === 'general' && (
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

                                    {/* System Proxy */}
                                    <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-zinc-300">System Proxy</div>
                                            <div className="text-xs text-zinc-500 mt-0.5">
                                                Configure macOS system proxy to route all HTTP/HTTPS requests through this server. Requires administrator permissions.
                                            </div>
                                        </div>
                                        <div className="flex-1 flex justify-end">
                                            <button
                                                onClick={() => onUpdate({ systemProxyEnabled: !(workspace.systemProxyEnabled || false) })}
                                                className={cn(
                                                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900",
                                                    workspace.systemProxyEnabled ? "bg-blue-600" : "bg-zinc-700"
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                                        workspace.systemProxyEnabled ? "translate-x-6" : "translate-x-1"
                                                    )}
                                                />
                                            </button>
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
                            )}

                            {activeTab === 'integration' && (
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
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

