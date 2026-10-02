import React, { useState, useMemo, useRef, useEffect } from 'react'
import type { ApiLogEntry } from '@proxy-app/shared'
import { matchPath } from '@proxy-app/shared'
import type { EndpointDef } from '@proxy-app/shared'
import { Search, X, Trash2, ListRestart, Split, Loader2, Info, FileJson, LayoutList, Timer, ChevronUp, ChevronDown } from 'lucide-react'
import { CopyButton, ResizablePanelGroup, ResizablePanel, ResizableHandle, Tabs, TabsList, TabsTrigger, TabsContent, cn } from '@proxy-app/ui'
import { LogDetailHeader, HeadersSection, RequestSection, BodyView } from './LogDetail'

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
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'headers' | 'request' | 'response' | 'timing'>('overview')
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

  // Logs in the order the list renders them (date groups, newest first), for prev/next navigation
  const orderedLogs = useMemo(() => {
    const visible = new Set(filteredLogs.map((log) => log.id))
    return Object.values(groupedLogs).flat().filter((log) => visible.has(log.id))
  }, [groupedLogs, filteredLogs])
  const selectedIndex = selectedLog ? orderedLogs.findIndex((log) => log.id === selectedLog.id) : -1

  const selectAdjacent = (delta: number) => {
    const next = orderedLogs[selectedIndex + delta]
    if (!next) return
    keepTabOnSelectRef.current = true
    setSelectedLog(next)
    scrollContainerRef.current?.querySelector(`[data-log-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  useEffect(() => {
    if (!selectedLog) return
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable || el.closest('[role="menu"]'))) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        selectAdjacent(-1)
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        selectAdjacent(1)
      } else if (e.key === 'Escape' && variant === 'extension') {
        setSelectedLog(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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

  // Prev/next navigation keeps the current tab so the same section can be compared across requests
  const keepTabOnSelectRef = useRef(false)
  useEffect(() => {
    if (keepTabOnSelectRef.current) {
      keepTabOnSelectRef.current = false
      return
    }
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
          updatedLog.captureTrace?.length !== selectedLog.captureTrace?.length ||
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

  const formatDuration = (ms: number) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`)

  const renderTiming = (log: ApiLogEntry) => {
    const start = new Date(log.timestamp)
    const end = log.duration !== undefined ? new Date(start.getTime() + log.duration) : undefined
    const barColor =
      log.status === 'pending' ? 'bg-blue-500/60' : log.status === 'error' || (log.statusCode ?? 0) >= 400 ? 'bg-red-500/60' : 'bg-green-500/60'
    const sameEndpoint = apiLogs
      .filter((l) => l.method === log.method && l.path === log.path && l.duration !== undefined)
      .map((l) => l.duration as number)
    const min = sameEndpoint.length ? Math.min(...sameEndpoint) : 0
    const max = sameEndpoint.length ? Math.max(...sameEndpoint) : 0
    const avg = sameEndpoint.length ? sameEndpoint.reduce((a, b) => a + b, 0) / sameEndpoint.length : 0
    const pct = (ms: number) => `${max > 0 ? Math.max(1, (ms / max) * 100) : 0}%`

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 w-32">Started:</span>
          <span className="text-xs text-zinc-300">{formatDate(log.timestamp)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 w-32">Finished:</span>
          <span className="text-xs text-zinc-300">{end ? formatDate(end.toISOString()) : log.status === 'pending' ? 'Pending' : '—'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 w-32">Duration:</span>
          <span className="text-xs text-zinc-300">{log.duration !== undefined ? formatDuration(log.duration) : '—'}</span>
        </div>
        <div className="flex flex-col gap-2 p-3 rounded-md bg-zinc-900/50 border border-zinc-800">
          <div className="text-xs font-medium text-zinc-400">Waterfall</div>
          <div className="grid grid-cols-[96px_1fr_64px] items-center gap-3">
            <span className="text-xs text-zinc-500">Waiting</span>
            <div className="h-2 rounded bg-zinc-800 overflow-hidden">
              <div className={cn('h-full rounded', barColor, log.status === 'pending' && 'animate-pulse')} style={{ width: log.duration !== undefined || log.status === 'pending' ? '100%' : '0%' }} />
            </div>
            <span className="text-xs text-zinc-300 text-right">{log.duration !== undefined ? formatDuration(log.duration) : '—'}</span>
          </div>
          <div className="grid grid-cols-[96px_1fr_64px] items-center gap-3 border-t border-zinc-800 pt-2">
            <span className="text-xs text-zinc-400">Total</span>
            <span />
            <span className="text-xs text-zinc-200 text-right">{log.duration !== undefined ? formatDuration(log.duration) : '—'}</span>
          </div>
        </div>
        {sameEndpoint.length > 1 && log.duration !== undefined && (
          <div className="flex flex-col gap-2 p-3 rounded-md bg-zinc-900/50 border border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-zinc-400">Compared to {log.method} {log.path}</div>
              <span className="text-xs text-zinc-600">{sameEndpoint.length} requests</span>
            </div>
            <div className="relative h-2 rounded bg-zinc-800">
              <div className="absolute inset-y-0 rounded bg-zinc-700" style={{ left: pct(min), width: `calc(${pct(max)} - ${pct(min)})` }} />
              <div className="absolute -top-1 -bottom-1 w-px bg-zinc-400" style={{ left: pct(avg) }} title={`avg ${formatDuration(avg)}`} />
              <div className={cn('absolute -top-1 w-2 h-4 -ml-1 rounded-sm', barColor.replace('/60', ''))} style={{ left: pct(log.duration) }} title="This request" />
            </div>
            <div className="flex justify-between text-xs text-zinc-500">
              <span>min {formatDuration(min)}</span>
              <span>avg {formatDuration(avg)}</span>
              <span>max {formatDuration(max)}</span>
            </div>
          </div>
        )}
      </div>
    )
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
      { id: 'timing' as const, label: 'Timing', icon: Timer },
    ]

    return (
      <div className="flex flex-col h-full">
        <LogDetailHeader
          log={log}
          inDefinitions={isInDefinitions(log)}
          onAddToDefinitions={onAddToDefinitions}
          onCreateMock={onCreateMock}
          onFilterEndpoint={setSearchQuery}
        />
        <Tabs value={activeDetailTab} onValueChange={(v) => setActiveDetailTab(v as typeof activeDetailTab)} className="flex flex-col flex-1 min-h-0">
          <TabsList variant="segmented" className="shrink-0 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon, badge }) => (
              <TabsTrigger key={id} value={id} variant="segmented" className="whitespace-nowrap">
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
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-red-400">Error details</span>
                    <CopyButton text={log.error} iconSize="w-3.5 h-3.5" className="p-1" title="Copy error details" />
                  </div>
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
                <div className="group flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-32">IP Address:</span>
                  <span className="text-xs text-zinc-300 font-mono">{log.ipAddress}</span>
                  <CopyButton text={log.ipAddress} iconSize="w-3 h-3" className="p-1 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Copy ip address" />
                </div>
              )}
              {(log.requestUrl || log.targetUrl || log.isBypass || log.isMock) && (
                <div className="flex flex-col gap-2 p-3 rounded-md bg-zinc-900/50 border border-zinc-800">
                  <div className="text-xs font-medium text-zinc-400">proxy / redirect</div>
                  {log.requestUrl && (
                    <div className="group flex flex-col gap-0.5">
                      <span className="text-xs text-zinc-500">Original:</span>
                      <div className="flex items-start gap-1">
                        <span className="text-xs text-zinc-300 font-mono break-all">{log.requestUrl}</span>
                        <CopyButton text={log.requestUrl} iconSize="w-3 h-3" className="p-1 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Copy original URL" />
                      </div>
                    </div>
                  )}
                  {log.isMock ? (
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-violet-500/20 text-violet-400 border border-violet-500/30">MOCK</span>
                      <span className="text-xs text-violet-400">Mock response</span>
                    </div>
                  ) : log.isBypass ? (
                    <div className="group flex items-center gap-2">
                      <Split className="w-3.5 h-3.5 text-amber-500 rotate-90" />
                      <span className="text-xs text-amber-400">Bypass request</span>
                      {log.targetUrl && (
                        <>
                          <span className="text-xs text-zinc-500"> to </span>
                          <span className="text-xs text-zinc-300 font-mono break-all">{log.targetUrl}</span>
                          <CopyButton text={log.targetUrl} iconSize="w-3 h-3" className="p-1 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Copy target URL" />
                        </>
                      )}
                    </div>
                  ) : log.targetUrl ? (
                    <div className="group flex flex-col gap-0.5">
                      <span className="text-xs text-zinc-500">Proxied to:</span>
                      <div className="flex items-start gap-1">
                        <span className="text-xs text-zinc-300 font-mono break-all">{log.targetUrl}</span>
                        <CopyButton text={log.targetUrl} iconSize="w-3 h-3" className="p-1 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Copy target URL" />
                      </div>
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
                <div className="group flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-32 min-w-32 whitespace-nowrap inline-block">User Agent:</span>
                  <span className="text-xs text-zinc-300 font-mono break-all inline-block">{log.userAgent}</span>
                  <CopyButton text={log.userAgent} iconSize="w-3 h-3" className="p-1 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Copy user agent" />
                </div>
              )}
              {log.apiKey && (
                <div className="group flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-32 min-w-32 whitespace-nowrap inline-block">API Key:</span>
                  <span className="text-xs text-zinc-300 font-mono break-all inline-block">{log.apiKey}</span>
                  <CopyButton text={log.apiKey} iconSize="w-3 h-3" className="p-1 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Copy API key" />
                </div>
              )}
              {log.idempotencyKey && (
                <div className="group flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-32">Idempotency Key:</span>
                  <span className="text-xs text-zinc-300 font-mono break-all">{log.idempotencyKey}</span>
                  <CopyButton text={log.idempotencyKey} iconSize="w-3 h-3" className="p-1 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Copy idempotency key" />
                </div>
              )}
              {queryParams.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-zinc-400">Query Parameters</div>
                    <CopyButton
                      text={queryParams.map(([key, value]) => `${key}=${value}`).join('\n')}
                      iconSize="w-3.5 h-3.5"
                      title="Copy query parameters"
                    />
                  </div>
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
            </div>
            </TabsContent>
            <TabsContent value="headers" className="mt-0">
              <HeadersSection log={log} />
            </TabsContent>
            <TabsContent value="request" className="mt-0">
              <RequestSection log={log} />
            </TabsContent>
            <TabsContent value="response" className="mt-0">
            <div className="space-y-2">
              <BodyView
                title="Response Body"
                body={(log.status === 'completed' || log.status === 'error') ? log.responseBody : undefined}
                empty={variant === 'extension'
                  ? 'Response body not captured (may appear shortly if captured from page)'
                  : 'No response body captured'}
              />
              {log.captureTrace && log.captureTrace.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-300">Capture Trace</h3>
                    <CopyButton text={log.captureTrace.join('\n')} title="Copy capture trace" />
                  </div>
                  <div className="bg-zinc-900/80 border border-zinc-700 rounded-md p-3 overflow-auto max-h-[240px] custom-scrollbar">
                    <ol className="space-y-1">
                      {log.captureTrace.map((step, i) => (
                        <li key={i} className="text-xs font-mono text-zinc-400 break-all">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
            </TabsContent>
            <TabsContent value="timing" className="mt-0">
              {renderTiming(log)}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    )
  }

  const detailsNavigator = selectedLog && selectedIndex >= 0 && (
    <div className="flex items-center gap-1">
      <span className="text-xs text-zinc-600 tabular-nums mr-1">
        {selectedIndex + 1} / {orderedLogs.length}
      </span>
      <button
        onClick={() => selectAdjacent(-1)}
        disabled={selectedIndex <= 0}
        className="p-1.5 hover:bg-zinc-800 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        title="Previous request (↑ / k)"
      >
        <ChevronUp className="w-4 h-4 text-zinc-400" />
      </button>
      <button
        onClick={() => selectAdjacent(1)}
        disabled={selectedIndex >= orderedLogs.length - 1}
        className="p-1.5 hover:bg-zinc-800 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        title="Next request (↓ / j)"
      >
        <ChevronDown className="w-4 h-4 text-zinc-400" />
      </button>
    </div>
  )

  const toolbar = (
    <div className="border-b border-zinc-900 bg-zinc-900/30 p-2 flex items-center gap-2 shrink-0">
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
      {filteredLogs.length > 0 ? (
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
      {Object.entries(groupedLogs).map(([dateGroup, logs]) => {
        const groupLogs = logs.filter((log) => filteredLogs.some((fl) => fl.id === log.id))
        if (groupLogs.length === 0) return null
        return (
          <div key={dateGroup} className="mb-4">
            {Object.entries(groupedLogs).length > 1 && (
              <div className="px-4 py-2 bg-zinc-900/30 border-b border-zinc-900 sticky top-0 flex gap-2 items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-400">{dateGroup}</h3>
              </div>
            )}
            <div className="space-y-0.5">
              {groupLogs.map((log) => (
                <button
                  key={log.id}
                  data-log-id={log.id}
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
        <div className="flex flex-row justify-between items-center h-10 px-3 border-b border-zinc-900 bg-zinc-900/30 shrink-0">
          <span className="text-xs font-medium text-zinc-400">Requests</span>
          <span className="text-xs text-zinc-600">{filteredLogs.length} {filteredLogs.length === 1 ? 'request' : 'requests'}</span>
        </div>
        {toolbar}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {requestsList}
          {selectedLog && (
            <div className="absolute inset-y-0 left-0 w-full bg-zinc-950 shadow-xl z-20 flex flex-col">
              <div className="flex items-center justify-between h-10 px-3 border-b border-zinc-900 bg-zinc-900/30 shrink-0">
                <span className="text-xs font-medium text-zinc-400">Log Details</span>
                <div className="flex items-center gap-1">
                  {detailsNavigator}
                  <div className="w-px h-4 bg-zinc-800 mx-1" />
                  <button onClick={() => setSelectedLog(null)} className="p-1.5 hover:bg-zinc-800 rounded transition-colors" title="Close (Esc)">
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
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
      <div className="flex flex-row justify-between items-center h-10 px-3 border-b border-zinc-900 bg-zinc-900/30 shrink-0">
        <span className="text-xs font-medium text-zinc-400">Requests</span>
        <span className="text-xs text-zinc-600">{filteredLogs.length} {filteredLogs.length === 1 ? 'request' : 'requests'}</span>
      </div>
      {toolbar}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0 overflow-hidden">
        <ResizablePanel defaultSize={40} minSize={20}>
          {requestsList}
        </ResizablePanel>
        <ResizableHandle className="w-1.5 bg-transparent after:bg-transparent hover:bg-zinc-700/50 transition-colors rounded" />
        <ResizablePanel defaultSize={60} minSize={30}>
          <div className="h-full min-h-0 overflow-y-auto bg-zinc-950 custom-scrollbar flex flex-col">
            <div className="flex items-center justify-between h-10 px-3 bg-zinc-900/30 border-b border-zinc-900 sticky top-0 shrink-0">
              <span className="text-xs font-medium text-zinc-400">Log Details</span>
              {detailsNavigator}
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
