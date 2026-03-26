import React, { useState, useMemo, useRef, useEffect } from 'react'
import type { ApiLogEntry } from '@proxy-app/shared'
import { matchPath } from '@proxy-app/shared'
import type { EndpointDef } from '@proxy-app/shared'
import { Search, X, Trash2, ListRestart, Split, Loader2, Plus, Info, FileJson, LayoutList, Server } from 'lucide-react'
import { CopyButton, ResizablePanelGroup, ResizablePanel, ResizableHandle, Tabs, TabsList, TabsTrigger, TabsContent, cn } from '@proxy-app/ui'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-json'

interface EnhancedLogPanelProps {
  apiLogs: ApiLogEntry[]
  onClearLogs: () => void
  searchQuery?: string
  onSearchQueryChange?: (query: string) => void
  onAddToDefinitions?: (log: ApiLogEntry) => void
  onCreateMock?: (log: ApiLogEntry) => void
  endpoints?: EndpointDef[]
  variant?: 'desktop' | 'extension'
}

type FilterType = {
  status?: number[]
  method?: string[]
  endpoint?: string
  date?: string
}

export const EnhancedLogPanel: React.FC<EnhancedLogPanelProps> = ({
  apiLogs,
  onClearLogs,
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
  onAddToDefinitions,
  onCreateMock,
  endpoints = [],
  variant = 'desktop',
}) => {
  const isInDefinitions = (log: ApiLogEntry) =>
    endpoints.some(
      (ep) =>
        matchPath(ep.path, log.path) !== null &&
        ep.method.toUpperCase() === (log.method || 'GET').toUpperCase()
    )
  const [selectedLog, setSelectedLog] = useState<ApiLogEntry | null>(null)
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'headers' | 'request' | 'response'>('overview')
  const [internalSearchQuery, setInternalSearchQuery] = useState('')
  const [filters, setFilters] = useState<FilterType>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery
  const setSearchQuery = (query: string) => {
    if (onSearchQueryChange) {
      onSearchQueryChange(query)
    } else {
      setInternalSearchQuery(query)
    }
  }

  const groupedLogs = useMemo(() => {
    const groups: Record<string, ApiLogEntry[]> = {}
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    apiLogs.forEach((log) => {
      const logDate = new Date(log.timestamp)
      let groupKey: string
      if (logDate.toDateString() === today.toDateString()) {
        groupKey = 'Today'
      } else if (logDate.toDateString() === yesterday.toDateString()) {
        groupKey = 'Yesterday'
      } else {
        groupKey = logDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
      }
      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(log)
    })
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    })
    return groups
  }, [apiLogs])

  const filteredLogs = useMemo(() => {
    let filtered = apiLogs
    if (searchQuery) {
      filtered = filtered.filter(
        (log) =>
          log.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.requestId?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter((log) => log.statusCode !== undefined && filters.status!.includes(log.statusCode))
    }
    if (filters.method && filters.method.length > 0) {
      filtered = filtered.filter((log) => filters.method!.includes(log.method))
    }
    if (filters.endpoint) {
      filtered = filtered.filter((log) => log.path.toLowerCase().includes(filters.endpoint!.toLowerCase()))
    }
    return filtered
  }, [apiLogs, searchQuery, filters])

  const uniqueMethods = useMemo(() => Array.from(new Set(apiLogs.map((log) => log.method))), [apiLogs])
  const uniqueStatusCodes = useMemo(() => {
    const codes = apiLogs.map((log) => log.statusCode).filter((code): code is number => code !== undefined)
    return Array.from(new Set(codes)).sort((a, b) => a - b)
  }, [apiLogs])

  useEffect(() => {
    if (variant === 'extension') {
      if (selectedLog && !filteredLogs.find((log) => log.id === selectedLog.id)) {
        setSelectedLog(null)
      }
      return
    }
    if (!selectedLog && filteredLogs.length > 0) {
      setSelectedLog(filteredLogs[0])
    } else if (selectedLog && !filteredLogs.find((log) => log.id === selectedLog.id)) {
      setSelectedLog(filteredLogs[0] || null)
    }
  }, [filteredLogs, selectedLog, variant])

  useEffect(() => {
    setActiveDetailTab('overview')
  }, [selectedLog?.id])

  useEffect(() => {
    if (selectedLog?.id) {
      const updatedLog = apiLogs.find((log) => log.id === selectedLog.id)
      if (updatedLog) {
        const hasChanged =
          updatedLog.status !== selectedLog.status ||
          updatedLog.statusCode !== selectedLog.statusCode ||
          updatedLog.statusMessage !== selectedLog.statusMessage ||
          updatedLog.duration !== selectedLog.duration ||
          updatedLog.responseBody !== selectedLog.responseBody ||
          updatedLog.requestBody !== selectedLog.requestBody ||
          updatedLog.error !== selectedLog.error ||
          updatedLog.requestUrl !== selectedLog.requestUrl ||
          updatedLog.targetUrl !== selectedLog.targetUrl ||
          JSON.stringify(updatedLog.requestHeaders) !== JSON.stringify(selectedLog.requestHeaders) ||
          JSON.stringify(updatedLog.responseHeaders) !== JSON.stringify(selectedLog.responseHeaders)
        if (hasChanged) setSelectedLog(updatedLog)
      }
    }
  }, [apiLogs])

  const getStatusColor = (status: number | undefined, logStatus?: 'pending' | 'completed' | 'error') => {
    if (logStatus === 'pending') return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    if (logStatus === 'error') return 'bg-red-500/20 text-red-400 border-red-500/30'
    if (status === undefined) return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    if (status >= 200 && status < 300) return 'bg-green-500/20 text-green-400 border-green-500/30'
    if (status >= 400) return 'bg-red-500/20 text-red-400 border-red-500/30'
    return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  }

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const formatDate = (timestamp: string) =>
    new Date(timestamp).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    })

  const toggleMethodFilter = (method: string) => {
    setFilters((prev) => ({
      ...prev,
      method: prev.method?.includes(method) ? prev.method.filter((m) => m !== method) : [...(prev.method || []), method],
    }))
  }
  const toggleStatusFilter = (status: number) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status?.includes(status) ? prev.status.filter((s) => s !== status) : [...(prev.status || []), status],
    }))
  }
  const resetFilters = () => {
    setFilters({})
    setSearchQuery('')
  }

  const parseQueryParams = (url: string): [string, string][] => {
    try {
      const u = new URL(url)
      return Array.from(u.searchParams.entries())
    } catch {
      return []
    }
  }

  const renderLogDetailContent = (log: ApiLogEntry) => {
    const queryParams = parseQueryParams(log.requestUrl || log.targetUrl || '')
    const hasRequestHeaders = log.requestHeaders && Object.keys(log.requestHeaders).length > 0
    const hasResponseHeaders = log.responseHeaders && Object.keys(log.responseHeaders).length > 0
    const hasHeaders = hasRequestHeaders || hasResponseHeaders

    const tabs = [
      { id: 'overview' as const, label: 'Overview', icon: Info },
      { id: 'headers' as const, label: 'Headers', icon: LayoutList, badge: hasHeaders ? (Object.keys(log.requestHeaders || {}).length + Object.keys(log.responseHeaders || {}).length) : 0 },
      { id: 'request' as const, label: 'Request', icon: FileJson, badge: log.requestBody ? 1 : 0 },
      { id: 'response' as const, label: 'Response', icon: FileJson, badge: log.responseBody ? 1 : 0 },
    ]

    const renderJsonBlock = (body: string) => {
      try {
        const parsed = JSON.parse(body)
        return highlight(JSON.stringify(parsed, null, 2), languages.json, 'json')
      } catch {
        return body
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
      }
    }

    const renderHeadersTable = (headers: Record<string, string>, title: string) => (
      <div className="space-y-2">
        <div className="text-xs font-medium text-zinc-400">{title}</div>
        <div className="overflow-x-auto rounded border border-zinc-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-700 bg-zinc-800/50">
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Name</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(headers).map(([key, value]) => (
                <tr key={key} className="border-b border-zinc-800/50 last:border-0">
                  <td className="px-3 py-2 font-mono text-zinc-300">{key}</td>
                  <td className="px-3 py-2 font-mono text-zinc-400 break-all">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )

    return (
      <div className="flex flex-col h-full">
        <p className="text-lg font-bold text-white break-words overflow-wrap-anywhere shrink-0 mb-3">
          {log.method} {log.path}
        </p>
        <Tabs value={activeDetailTab} onValueChange={(v) => setActiveDetailTab(v as typeof activeDetailTab)} className="flex flex-col flex-1 min-h-0">
          <TabsList variant="pill" className="justify-start gap-2 shrink-0 overflow-x-auto flex-wrap">
            {tabs.map(({ id, label, icon: Icon, badge }) => (
              <TabsTrigger key={id} value={id} variant="pill" className="gap-1.5 text-xs whitespace-nowrap">
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
                {badge !== undefined && badge > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-600/80 text-zinc-300 data-[state=active]:bg-white/20 data-[state=active]:text-white">
                    {badge}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex-1 overflow-y-auto py-4 min-h-0 custom-scrollbar">
            <TabsContent value="overview" className="mt-0">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 w-32">Status:</span>
                <span className="text-xs text-zinc-300">
                  {log.status === 'pending'
                    ? 'Pending'
                    : log.status === 'error'
                      ? `Error${log.error ? `: ${log.error}` : ''}`
                      : log.statusCode
                        ? `${log.statusCode} ${log.statusCode >= 200 && log.statusCode < 300 ? 'OK' : ''}`
                        : log.status || 'Unknown'}
                </span>
              </div>
              {log.status === 'error' && log.error && (
                <div className="flex flex-col gap-1 p-3 rounded-md bg-red-500/10 border border-red-500/30">
                  <span className="text-xs font-medium text-red-400">Error details</span>
                  <span className="text-xs text-zinc-300 font-mono break-all">{log.error}</span>
                </div>
              )}
              {log.id && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-32">Request ID:</span>
                  <CopyButton text={log.id} variant="inline" iconSize="w-3 h-3" className="text-xs text-purple-400 hover:text-purple-300 font-mono" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 w-32">Time:</span>
                <span className="text-xs text-zinc-300">{formatDate(log.timestamp)}</span>
              </div>
              {log.ipAddress && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-32">IP Address:</span>
                  <span className="text-xs text-zinc-300 font-mono">{log.ipAddress}</span>
                </div>
              )}
              {(log.requestUrl || log.targetUrl || log.isBypass || log.isMock) && (
                <div className="flex flex-col gap-2 p-3 rounded-md bg-zinc-900/50 border border-zinc-800">
                  <div className="text-xs font-medium text-zinc-400">proxy / redirect</div>
                  {log.requestUrl && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-zinc-500">Original:</span>
                      <span className="text-xs text-zinc-300 font-mono break-all">{log.requestUrl}</span>
                    </div>
                  )}
                  {log.isMock ? (
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-violet-500/20 text-violet-400 border border-violet-500/30">MOCK</span>
                      <span className="text-xs text-violet-400">Mock response</span>
                    </div>
                  ) : log.isBypass ? (
                    <div className="flex items-center gap-2">
                      <Split className="w-3.5 h-3.5 text-amber-500 rotate-90" />
                      <span className="text-xs text-amber-400">Bypass request</span>
                      {log.targetUrl && (
                        <>
                          <span className="text-xs text-zinc-500"> to </span>
                          <span className="text-xs text-zinc-300 font-mono break-all">{log.targetUrl}</span>
                        </>
                      )}
                    </div>
                  ) : log.targetUrl ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-zinc-500">Proxied to:</span>
                      <span className="text-xs text-zinc-300 font-mono break-all">{log.targetUrl}</span>
                    </div>
                  ) : null}
                </div>
              )}
              {log.duration !== undefined && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-32">Duration:</span>
                  <span className="text-xs text-zinc-300">
                    {log.duration < 1000 ? `${log.duration}ms` : `${(log.duration / 1000).toFixed(2)}s`}
                  </span>
                </div>
              )}
              {log.userAgent && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-32 min-w-32 whitespace-nowrap inline-block">User Agent:</span>
                  <span className="text-xs text-zinc-300 font-mono break-all inline-block">{log.userAgent}</span>
                </div>
              )}
              {log.apiKey && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-32 min-w-32 whitespace-nowrap inline-block">API Key:</span>
                  <span className="text-xs text-zinc-300 font-mono break-all inline-block">{log.apiKey}</span>
                </div>
              )}
              {log.idempotencyKey && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-32">Idempotency Key:</span>
                  <span className="text-xs text-zinc-300 font-mono break-all">{log.idempotencyKey}</span>
                </div>
              )}
              {queryParams.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-zinc-400">Query Parameters</div>
                  <div className="overflow-x-auto rounded border border-zinc-700">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-700 bg-zinc-800/50">
                          <th className="px-3 py-2 text-left font-medium text-zinc-500">Key</th>
                          <th className="px-3 py-2 text-left font-medium text-zinc-500">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queryParams.map(([key, value]) => (
                          <tr key={key} className="border-b border-zinc-800/50 last:border-0">
                            <td className="px-3 py-2 font-mono text-zinc-300">{key}</td>
                            <td className="px-3 py-2 font-mono text-zinc-400 break-all">{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {(onAddToDefinitions || onCreateMock) && (
                <div className="flex items-center gap-2 pt-2">
                  {onAddToDefinitions && !isInDefinitions(log) && (
                    <button
                      onClick={() => onAddToDefinitions(log)}
                      className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 rounded-md transition-colors"
                      title="Add this request to definitions"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add to Definitions</span>
                    </button>
                  )}
                  {onCreateMock && log.responseBody && !log.isMock && !isInDefinitions(log) && (
                    <button
                      onClick={() => onCreateMock(log)}
                      className="flex items-center gap-2 px-3 py-2 text-xs bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 rounded-md transition-colors"
                      title="Create a mock endpoint from this response"
                    >
                      <Server className="w-4 h-4" />
                      <span>Create Mock</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            </TabsContent>
            <TabsContent value="headers" className="mt-0">
            <div className="space-y-6">
              {hasRequestHeaders ? renderHeadersTable(log.requestHeaders!, 'Request Headers') : null}
              {hasResponseHeaders ? renderHeadersTable(log.responseHeaders!, 'Response Headers') : null}
              {!hasHeaders && (
                <p className="text-xs text-zinc-500 italic">No headers captured</p>
              )}
            </div>
            </TabsContent>
            <TabsContent value="request" className="mt-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-300">Request Body</h3>
                {log.requestBody && <CopyButton text={log.requestBody} title="Copy request body" />}
              </div>
              <div className="bg-zinc-900/80 border border-zinc-700 rounded-md p-4 overflow-auto max-h-[320px] custom-scrollbar">
                {log.requestBody ? (
                  <pre
                    className="text-xs font-mono whitespace-pre-wrap language-json"
                    dangerouslySetInnerHTML={{ __html: renderJsonBlock(log.requestBody) }}
                  />
                ) : (
                  <p className="text-xs text-zinc-500 italic">No request body (GET requests typically have no body)</p>
                )}
              </div>
            </div>
            </TabsContent>
            <TabsContent value="response" className="mt-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-300">Response Body</h3>
                {log.responseBody && <CopyButton text={log.responseBody} title="Copy response body" />}
              </div>
              <div className="bg-zinc-900/80 border border-zinc-700 rounded-md p-4 overflow-auto max-h-[320px] custom-scrollbar">
                {(log.status === 'completed' || log.status === 'error') && log.responseBody ? (
                  <pre
                    className="text-xs font-mono whitespace-pre-wrap language-json"
                    dangerouslySetInnerHTML={{ __html: renderJsonBlock(log.responseBody) }}
                  />
                ) : (
                  <p className="text-xs text-zinc-500 italic">
                    {variant === 'extension'
                      ? 'Response body not captured (may appear shortly if captured from page)'
                      : 'No response body captured'}
                  </p>
                )}
              </div>
            </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    )
  }

  const toolbar = (
    <div className="border-b border-zinc-800 bg-zinc-900/50 p-2 flex items-center gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Filter by path or resource ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-800 rounded transition-colors" title="Clear search">
              <X className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {uniqueMethods.map((method) => {
            const isActive = filters.method?.includes(method)
            return (
              <button
                key={method}
                onClick={() => toggleMethodFilter(method)}
                className={cn(
                  "px-3 py-1.5 text-xs border rounded-md flex items-center gap-1.5 transition-colors",
                  isActive ? "bg-purple-500/20 border-purple-500/50 text-purple-300" : "bg-zinc-900 hover:bg-zinc-700 border-zinc-700 text-zinc-300"
                )}
              >
                {method}
                {isActive && <X className="w-3 h-3" onClick={(e) => { e.stopPropagation(); toggleMethodFilter(method) }} />}
              </button>
            )
          })}
          <button onClick={resetFilters} className="px-3 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-300 transition-colors">
            <ListRestart className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClearLogs} className="px-3 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-300 flex items-center gap-1.5 transition-colors" title="Clear logs">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
    </div>
  )

  const requestsList = (
    <div className="h-full min-h-0 flex flex-col border-r border-zinc-800 custom-scrollbar" ref={scrollContainerRef}>
      <div className="sticky top-0 z-10 px-4 py-3 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between shrink-0">
        <h3 className="text-xs font-semibold text-zinc-400">Requests</h3>
        <span className="text-xs text-zinc-500 font-mono">{filteredLogs.length} {filteredLogs.length === 1 ? 'request' : 'requests'}</span>
      </div>
      {filteredLogs.length > 0 ? (
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
      {Object.entries(groupedLogs).map(([dateGroup, logs]) => {
        const groupLogs = logs.filter((log) => filteredLogs.some((fl) => fl.id === log.id))
        if (groupLogs.length === 0) return null
        return (
          <div key={dateGroup} className="mb-4">
            {Object.entries(groupedLogs).length > 1 && (
              <div className="px-4 py-2 bg-zinc-900/80 border-b border-zinc-800 sticky top-0 flex gap-2 items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-400">{dateGroup}</h3>
              </div>
            )}
            <div className="space-y-0.5">
              {groupLogs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={cn(
                    "w-full px-4 py-2.5 text-left hover:bg-zinc-900/50 transition-colors border-l-2",
                    selectedLog?.id === log.id ? "bg-purple-500/10 border-purple-500" : "border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2 pr-5 relative">
                    {log.status === 'pending' ? (
                      <span className={cn("px-2 py-0.5 text-[10px] font-medium rounded border flex items-center gap-1", getStatusColor(log.statusCode, log.status))}>
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        Pending
                      </span>
                    ) : (
                      <span className={cn("px-2 py-0.5 text-[10px] font-medium rounded border", getStatusColor(log.statusCode, log.status))} title={log.status === 'error' && log.error ? log.error : undefined}>
                        {log.status === 'error' ? 'Error' : log.statusCode || '?'} {log.statusCode && log.statusCode >= 200 && log.statusCode < 300 ? 'OK' : ''}
                      </span>
                    )}
                    <span className="text-xs font-mono text-zinc-300">{log.method}</span>
                    <span className="text-xs text-zinc-400 flex-1 truncate">{log.path}</span>
                    <span className="text-[10px] text-zinc-600">{formatTime(log.timestamp)}</span>
                    {log.isMock && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-semibold rounded bg-violet-500/20 text-violet-400 border border-violet-500/30">
                        MOCK
                      </span>
                    )}
                    {log.isBypass && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 flex-shrink-0" title="Bypass request - routed to bypass URI">
                        <Split className="w-3.5 h-3.5 rotate-90 text-zinc-700" />
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })}
      </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-zinc-600 text-sm">No logs found</div>
      )}
    </div>
  )

  if (variant === 'extension') {
    return (
      <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
        {toolbar}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {requestsList}
          {selectedLog && (
            <div className="absolute inset-y-0 left-0 w-full bg-zinc-900 shadow-xl z-20 flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
                <h3 className="text-xs font-semibold text-zinc-400">Log Details</h3>
                  <button onClick={() => setSelectedLog(null)} className="p-1.5 hover:bg-zinc-800 rounded transition-colors" title="Close">
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">{renderLogDetailContent(selectedLog)}</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col flex-1 bg-zinc-950 text-zinc-100 overflow-hidden">
      {toolbar}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0 overflow-hidden">
        <ResizablePanel defaultSize={40} minSize={20}>
          {requestsList}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={60} minSize={30}>
          <div className="h-full min-h-0 overflow-y-auto bg-zinc-900/30 custom-scrollbar flex flex-col">
            <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800 sticky top-0 shrink-0">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Log Details</h3>
            </div>
            {selectedLog ? (
              <div className="flex-1 min-h-0 p-6 space-y-6">{renderLogDetailContent(selectedLog)}</div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-zinc-600 text-sm">Select a log entry to view details</div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
