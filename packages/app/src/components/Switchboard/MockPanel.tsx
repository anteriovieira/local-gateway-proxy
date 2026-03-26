import React, { useState, useMemo } from 'react'
import type { Workspace, EndpointDef } from '../../types'
import { cn } from '@proxy-app/ui'
import { Plus, Trash2, ChevronDown, ChevronRight, Check, Database } from 'lucide-react'
import { JsonEditor } from '../JsonEditor'

interface MockPanelProps {
  workspace: Workspace
  onUpdate: (updates: Partial<Workspace>) => void
}

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ANY'] as const

function getMethodColor(method: string) {
  switch (method.toLowerCase()) {
    case 'get': return 'bg-sky-500/10 text-sky-400'
    case 'post': return 'bg-emerald-500/10 text-emerald-400'
    case 'put': return 'bg-amber-500/10 text-amber-400'
    case 'delete': return 'bg-red-500/10 text-red-400'
    case 'patch': return 'bg-purple-500/10 text-purple-400'
    default: return 'bg-zinc-500/10 text-zinc-400'
  }
}

function createDefaultMock(): EndpointDef {
  return {
    path: '/api/mock',
    method: 'GET',
    uriTemplate: '',
    isMock: true,
    enabled: true,
    mockResponse: '{\n  "message": "Hello from mock"\n}',
    mockStatusCode: 200,
    mockHeaders: { 'content-type': 'application/json' },
    mockDelay: 0,
  }
}

export const MockPanel: React.FC<MockPanelProps> = ({ workspace, onUpdate }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const mockEndpoints = workspace.endpoints
    .map((ep, index) => ({ endpoint: ep, originalIndex: index }))
    .filter(({ endpoint }) => endpoint.isMock === true)

  // Parse available collections from mockDbConfig
  const collections = useMemo(() => {
    if (!workspace.mockDbConfig?.initialData) return []
    try {
      const parsed = JSON.parse(workspace.mockDbConfig.initialData)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return []
      return Object.keys(parsed).filter(k => Array.isArray(parsed[k]))
    } catch {
      return []
    }
  }, [workspace.mockDbConfig?.initialData])

  const hasMockDb = !!workspace.mockDbConfig && collections.length > 0

  const updateEndpoint = (originalIndex: number, updates: Partial<EndpointDef>) => {
    const newEndpoints = [...workspace.endpoints]
    newEndpoints[originalIndex] = { ...newEndpoints[originalIndex], ...updates }
    onUpdate({ endpoints: newEndpoints })
  }

  const addMock = () => {
    const newEndpoints = [...workspace.endpoints, createDefaultMock()]
    onUpdate({ endpoints: newEndpoints })
    setExpandedIndex(mockEndpoints.length)
  }

  const removeMock = (originalIndex: number) => {
    const newEndpoints = workspace.endpoints.filter((_, i) => i !== originalIndex)
    onUpdate({ endpoints: newEndpoints })
    setExpandedIndex(null)
  }

  const toggleMock = (originalIndex: number) => {
    const ep = workspace.endpoints[originalIndex]
    updateEndpoint(originalIndex, { enabled: ep.enabled === false ? true : false })
  }

  const updateMockHeader = (originalIndex: number, oldKey: string, newKey: string, value: string) => {
    const ep = workspace.endpoints[originalIndex]
    const headers = { ...(ep.mockHeaders ?? {}) }
    if (oldKey !== newKey) {
      delete headers[oldKey]
    }
    headers[newKey] = value
    updateEndpoint(originalIndex, { mockHeaders: headers })
  }

  const removeMockHeader = (originalIndex: number, key: string) => {
    const ep = workspace.endpoints[originalIndex]
    const headers = { ...(ep.mockHeaders ?? {}) }
    delete headers[key]
    updateEndpoint(originalIndex, { mockHeaders: headers })
  }

  const addMockHeader = (originalIndex: number) => {
    const ep = workspace.endpoints[originalIndex]
    const headers = { ...(ep.mockHeaders ?? {}), '': '' }
    updateEndpoint(originalIndex, { mockHeaders: headers })
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-300">Mock Endpoints</span>
          <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">
            {mockEndpoints.length}
          </span>
        </div>
        <button
          onClick={addMock}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Mock
        </button>
      </div>

      {/* List */}
      <div className="p-2">
        {mockEndpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-zinc-600 p-8 border border-dashed border-zinc-800 rounded-lg h-full">
            <p className="text-sm">No mock endpoints</p>
            <p className="text-xs mt-1">Add a mock to intercept requests with custom responses</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {mockEndpoints.map(({ endpoint: ep, originalIndex }, mockIdx) => {
              const isExpanded = expandedIndex === mockIdx
              const usesDb = !!ep.mockDbCollection
              return (
                <div
                  key={originalIndex}
                  className="rounded-md border border-zinc-800 bg-zinc-900/50 overflow-hidden"
                >
                  {/* Summary row */}
                  <div
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                    onClick={() => setExpandedIndex(isExpanded ? null : mockIdx)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleMock(originalIndex) }}
                      className={cn(
                        "w-4 h-4 rounded flex items-center justify-center transition-colors shrink-0",
                        ep.enabled !== false ? "bg-violet-500 text-white" : "bg-zinc-800 text-zinc-600"
                      )}
                    >
                      {ep.enabled !== false && <Check className="w-3 h-3" />}
                    </button>
                    <span className={cn("font-mono font-bold px-1.5 py-0.5 rounded text-[10px] w-12 text-center select-none shrink-0", getMethodColor(ep.method))}>
                      {ep.method}
                    </span>
                    <span className="font-mono text-xs text-zinc-300 truncate flex-1">{ep.path}</span>
                    {usesDb ? (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
                        <Database className="w-2.5 h-2.5" />
                        {ep.mockDbCollection}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 shrink-0">{ep.mockStatusCode ?? 200}</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeMock(originalIndex) }}
                      className="p-1 text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Expanded form */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800 px-3 py-3 flex flex-col gap-3">
                      {/* Method + Path */}
                      <div className="flex gap-2">
                        <select
                          value={ep.method}
                          onChange={(e) => updateEndpoint(originalIndex, { method: e.target.value })}
                          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600"
                        >
                          {METHODS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={ep.path}
                          onChange={(e) => updateEndpoint(originalIndex, { path: e.target.value })}
                          placeholder="/api/endpoint"
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                        />
                      </div>

                      {/* Delay */}
                      <div className="flex gap-2">
                        {!usesDb && (
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Status</label>
                            <input
                              type="number"
                              value={ep.mockStatusCode ?? 200}
                              onChange={(e) => updateEndpoint(originalIndex, { mockStatusCode: parseInt(e.target.value) || 200 })}
                              className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 font-mono focus:outline-none focus:border-zinc-600"
                            />
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Delay (ms)</label>
                          <input
                            type="number"
                            value={ep.mockDelay ?? 0}
                            onChange={(e) => updateEndpoint(originalIndex, { mockDelay: parseInt(e.target.value) || 0 })}
                            className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 font-mono focus:outline-none focus:border-zinc-600"
                          />
                        </div>
                      </div>

                      {/* Response Source toggle */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Response Source</label>
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateEndpoint(originalIndex, { mockDbCollection: undefined })}
                            className={cn(
                              "px-2.5 py-1 text-[11px] font-medium rounded transition-colors",
                              !usesDb
                                ? "bg-violet-500/20 text-violet-400"
                                : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                            )}
                          >
                            Fixed Response
                          </button>
                          {hasMockDb && (
                            <button
                              onClick={() => updateEndpoint(originalIndex, { mockDbCollection: collections[0] })}
                              className={cn(
                                "px-2.5 py-1 text-[11px] font-medium rounded transition-colors flex items-center gap-1",
                                usesDb
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                              )}
                            >
                              <Database className="w-3 h-3" />
                              Mock DB
                            </button>
                          )}
                        </div>
                      </div>

                      {usesDb ? (
                        <>
                          {/* Collection selector */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Collection</label>
                            <select
                              value={ep.mockDbCollection ?? ''}
                              onChange={(e) => updateEndpoint(originalIndex, { mockDbCollection: e.target.value })}
                              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 font-mono focus:outline-none focus:border-zinc-600"
                            >
                              {collections.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                            <div className="text-[10px] text-zinc-600 leading-relaxed">
                              CRUD operation is inferred from the HTTP method. Use path params (e.g. <code className="text-zinc-400">{'{id}'}</code>) for single-record operations.
                            </div>
                          </div>

                          {/* Response Template */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Response Template</label>
                            <JsonEditor
                              value={ep.mockResponseTemplate ?? '{{data}}'}
                              onChange={(code) => updateEndpoint(originalIndex, { mockResponseTemplate: code })}
                              height="80px"
                              jsonLang={false}
                            />
                            <div className="text-[10px] text-zinc-600 leading-relaxed">
                              Use <code className="text-zinc-400">{'{{data}}'}</code> for the full result or dot notation like <code className="text-zinc-400">{'{{data.metadata}}'}</code> to access nested properties.
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Response Headers */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Response Headers</label>
                              <button
                                onClick={() => addMockHeader(originalIndex)}
                                className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
                              >
                                + Add
                              </button>
                            </div>
                            {Object.entries(ep.mockHeaders ?? {}).map(([key, value], headerIdx) => (
                              <div key={headerIdx} className="flex gap-1.5 items-center">
                                <input
                                  type="text"
                                  value={key}
                                  onChange={(e) => updateMockHeader(originalIndex, key, e.target.value, value)}
                                  placeholder="header-name"
                                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-300 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                                />
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) => updateMockHeader(originalIndex, key, key, e.target.value)}
                                  placeholder="value"
                                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-300 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                                />
                                <button
                                  onClick={() => removeMockHeader(originalIndex, key)}
                                  className="p-0.5 text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Response Body */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Response Body</label>
                            <JsonEditor
                              value={ep.mockResponse ?? ''}
                              onChange={(code) => updateEndpoint(originalIndex, { mockResponse: code })}
                              height="120px"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
