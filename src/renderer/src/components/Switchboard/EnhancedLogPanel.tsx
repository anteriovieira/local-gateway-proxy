import React, { useState, useMemo, useRef, useEffect } from 'react'
import { ApiLogEntry } from '../../types'
import {
    Search, X, Copy,
    RefreshCw, Trash2, Terminal,
    ListRestart
} from 'lucide-react'
import { cn } from '../../utils'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../ui/resizable'

interface EnhancedLogPanelProps {
    apiLogs: ApiLogEntry[]
    onClearLogs: () => void
    onOpenTerminalLog: () => void
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
    onOpenTerminalLog
}) => {
    const [selectedLog, setSelectedLog] = useState<ApiLogEntry | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [filters, setFilters] = useState<FilterType>({})
    const [showFilters, setShowFilters] = useState(false)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Group logs by date
    const groupedLogs = useMemo(() => {
        const groups: Record<string, ApiLogEntry[]> = {}
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        apiLogs.forEach(log => {
            const logDate = new Date(log.timestamp)
            let groupKey: string

            if (logDate.toDateString() === today.toDateString()) {
                groupKey = 'Today'
            } else if (logDate.toDateString() === yesterday.toDateString()) {
                groupKey = 'Yesterday'
            } else {
                groupKey = logDate.toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                })
            }

            if (!groups[groupKey]) {
                groups[groupKey] = []
            }
            groups[groupKey].push(log)
        })

        // Sort logs within each group by timestamp (newest first)
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
        })

        return groups
    }, [apiLogs])

    // Filter logs
    const filteredLogs = useMemo(() => {
        let filtered = apiLogs

        // Search filter
        if (searchQuery) {
            filtered = filtered.filter(log =>
                log.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.requestId?.toLowerCase().includes(searchQuery.toLowerCase())
            )
        }

        // Status filter
        if (filters.status && filters.status.length > 0) {
            filtered = filtered.filter(log => filters.status!.includes(log.statusCode))
        }

        // Method filter
        if (filters.method && filters.method.length > 0) {
            filtered = filtered.filter(log => filters.method!.includes(log.method))
        }

        // Endpoint filter
        if (filters.endpoint) {
            filtered = filtered.filter(log =>
                log.path.toLowerCase().includes(filters.endpoint!.toLowerCase())
            )
        }

        return filtered
    }, [apiLogs, searchQuery, filters])

    // Get unique methods and status codes for filters
    const uniqueMethods = useMemo(() =>
        Array.from(new Set(apiLogs.map(log => log.method))),
        [apiLogs]
    )
    const uniqueStatusCodes = useMemo(() =>
        Array.from(new Set(apiLogs.map(log => log.statusCode))).sort((a, b) => a - b),
        [apiLogs]
    )

    // Auto-select first log if none selected
    useEffect(() => {
        if (!selectedLog && filteredLogs.length > 0) {
            setSelectedLog(filteredLogs[0])
        } else if (selectedLog && !filteredLogs.find(log => log.id === selectedLog.id)) {
            setSelectedLog(filteredLogs[0] || null)
        }
    }, [filteredLogs, selectedLog])

    const getStatusColor = (status: number) => {
        if (status >= 200 && status < 300) return 'bg-green-500/20 text-green-400 border-green-500/30'
        if (status >= 400) return 'bg-red-500/20 text-red-400 border-red-500/30'
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    }

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
    }

    const formatDate = (timestamp: string) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        })
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
    }

    const toggleMethodFilter = (method: string) => {
        setFilters(prev => ({
            ...prev,
            method: prev.method?.includes(method)
                ? prev.method.filter(m => m !== method)
                : [...(prev.method || []), method]
        }))
    }

    const toggleStatusFilter = (status: number) => {
        setFilters(prev => ({
            ...prev,
            status: prev.status?.includes(status)
                ? prev.status.filter(s => s !== status)
                : [...(prev.status || []), status]
        }))
    }

    const clearFilters = () => {
        setFilters({})
        setSearchQuery('')
    }

    const resetFilters = () => {
        setFilters({})
        setSearchQuery('')
    }

    const activeFilterCount = Object.values(filters).filter(v =>
        Array.isArray(v) ? v.length > 0 : Boolean(v)
    ).length

    return (
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
            {/* Top Bar - Filters and Actions */}
            <div className="border-b border-zinc-800 bg-zinc-900/50 p-2 flex items-center gap-2">
                {/* Search Bar */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Filter by resource ID"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50"
                    />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Method Filter */}
                    {uniqueMethods.map(method => {
                        const isActive = filters.method?.includes(method)
                        return (
                            <button
                                key={method}
                                onClick={() => toggleMethodFilter(method)}
                                className={cn(
                                    "px-3 py-1.5 text-xs border rounded-md flex items-center gap-1.5 transition-colors",
                                    isActive
                                        ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                                        : "bg-zinc-900 hover:bg-zinc-700 border-zinc-700 text-zinc-300"
                                )}
                            >
                                {method}
                                {isActive && (
                                    <X
                                        className="w-3 h-3"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            toggleMethodFilter(method)
                                        }}
                                    />
                                )}
                            </button>
                        )
                    })}
                    <button
                        onClick={resetFilters}
                        className="px-3 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-300 transition-colors"
                    >
                        <ListRestart className="w-3.5 h-3.5" />
                    </button>

                    <button
                        onClick={onOpenTerminalLog}
                        className="px-3 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-300 flex items-center gap-1.5 transition-colors"
                        title="Open terminal log"
                    >
                        <Terminal className="w-3.5 h-3.5" />
                    </button>

                    <button
                        onClick={onClearLogs}
                        className="px-3 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-300 flex items-center gap-1.5 transition-colors"
                        title="Clear logs"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Main Content - Two Panels */}
            <ResizablePanelGroup direction="horizontal" className="flex-1">
                {/* Left Panel - Log List */}
                <ResizablePanel defaultSize={40} minSize={20}>
                    <div className="h-full overflow-y-auto border-r border-zinc-800" ref={scrollContainerRef}>
                        {Object.entries(groupedLogs).map(([dateGroup, logs]) => {
                            const groupLogs = logs.filter(log =>
                                filteredLogs.some(fl => fl.id === log.id)
                            )
                            if (groupLogs.length === 0) return null

                            return (
                                <div key={dateGroup} className="mb-4">
                                    <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800 sticky top-0 flex gap-2 items-center justify-between">
                                        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                            {dateGroup}
                                        </h3>
                                        {dateGroup === 'Today' && (
                                            <div className="text-[10px] text-zinc-600 mt-1 flex items-center gap-2">

                                                <button className="text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                                    <RefreshCw className="w-3 h-3" />
                                                    Reload
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-0.5">
                                        {groupLogs.map(log => (
                                            <button
                                                key={log.id}
                                                onClick={() => setSelectedLog(log)}
                                                className={cn(
                                                    "w-full px-4 py-2.5 text-left hover:bg-zinc-900/50 transition-colors border-l-2",
                                                    selectedLog?.id === log.id
                                                        ? "bg-purple-500/10 border-purple-500"
                                                        : "border-transparent"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 pr-4 relative">
                                                    <span className={cn(
                                                        "px-2 py-0.5 text-[10px] font-medium rounded border",
                                                        getStatusColor(log.statusCode)
                                                    )}>
                                                        {log.statusCode} {log.statusCode >= 200 && log.statusCode < 300 ? 'OK' : ''}
                                                    </span>
                                                    <span className="text-xs font-mono text-zinc-300">
                                                        {log.method}
                                                    </span>
                                                    <span className="text-xs text-zinc-400 flex-1 truncate">
                                                        {log.path}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-600">
                                                        {formatTime(log.timestamp)}
                                                    </span>
                                                    {log.isBypass && (
                                                        <div className="w-2 h-2 absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-yellow-500 flex-shrink-0" title="Bypass request" />
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                        {filteredLogs.length === 0 && (
                            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                                No logs found
                            </div>
                        )}
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Right Panel - Log Details */}
                <ResizablePanel defaultSize={60} minSize={30}>
                    <div className="h-full overflow-y-auto bg-zinc-900/30">
                        <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800 sticky top-0 flex gap-2 items-center justify-between">
                            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                Log Details
                            </h3>

                        </div>
                        {selectedLog ? (


                            <div className="p-6 space-y-6">
                                {/* Header */}
                                <p className="text-lg font-bold text-white">
                                    {selectedLog.method} {selectedLog.path}
                                </p>

                                {/* Request Details */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-zinc-500 w-32">Status:</span>
                                        <span className={cn(
                                            "px-2 py-0.5 text-xs font-medium rounded border",
                                            getStatusColor(selectedLog.statusCode)
                                        )}>
                                            {selectedLog.statusCode} {selectedLog.statusCode >= 200 && selectedLog.statusCode < 300 ? 'OK' : ''}
                                        </span>
                                    </div>

                                    {selectedLog.id && (
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-zinc-500 w-32">Request ID:</span>
                                            <button
                                                onClick={() => copyToClipboard(selectedLog.id)}
                                                className="text-xs text-purple-400 hover:text-purple-300 font-mono flex items-center gap-1"
                                            >
                                                {selectedLog.id}
                                                <Copy className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-zinc-500 w-32">Time:</span>
                                        <span className="text-xs text-zinc-300">
                                            {formatDate(selectedLog.timestamp)}
                                        </span>
                                    </div>

                                    {selectedLog.ipAddress && (
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-zinc-500 w-32">IP Address:</span>
                                            <span className="text-xs text-zinc-300 font-mono">
                                                {selectedLog.ipAddress}
                                            </span>
                                        </div>
                                    )}

                                    {selectedLog.targetUrl && (
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-zinc-500 w-32">Target URL:</span>
                                            <span className="text-xs text-zinc-300 font-mono break-all">
                                                {selectedLog.targetUrl}
                                            </span>
                                        </div>
                                    )}

                                    {selectedLog.duration !== undefined && (
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-zinc-500 w-32">Duration:</span>
                                            <span className="text-xs text-zinc-300">
                                                {selectedLog.duration < 1000
                                                    ? `${selectedLog.duration}ms`
                                                    : `${(selectedLog.duration / 1000).toFixed(2)}s`}
                                            </span>
                                        </div>
                                    )}

                                    {selectedLog.userAgent && (
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-zinc-500 w-32">User Agent:</span>
                                            <span className="text-xs text-zinc-300 font-mono">
                                                {selectedLog.userAgent}
                                            </span>
                                        </div>
                                    )}

                                    {selectedLog.apiKey && (
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-zinc-500 w-32">API Key:</span>
                                            <span className="text-xs text-zinc-300 font-mono">
                                                {selectedLog.apiKey}
                                            </span>
                                        </div>
                                    )}

                                    {selectedLog.idempotencyKey && (
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-zinc-500 w-32">Idempotency Key:</span>
                                            <span className="text-xs text-zinc-300 font-mono break-all">
                                                {selectedLog.idempotencyKey}
                                            </span>
                                        </div>
                                    )}

                                    {selectedLog.isBypass && (
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-zinc-500 w-32">Bypass:</span>
                                            <span className="text-xs text-yellow-400">Yes</span>
                                        </div>
                                    )}
                                </div>

                                {/* Response Body */}
                                {selectedLog.responseBody && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold text-zinc-300">
                                                Response Body
                                            </h3>
                                            <button
                                                onClick={() => copyToClipboard(selectedLog.responseBody || '')}
                                                className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
                                                title="Copy response body"
                                            >
                                                <Copy className="w-4 h-4 text-zinc-400" />
                                            </button>
                                        </div>
                                        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-4 overflow-x-auto">
                                            <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap">
                                                {(() => {
                                                    try {
                                                        const parsed = JSON.parse(selectedLog.responseBody)
                                                        return JSON.stringify(parsed, null, 2)
                                                    } catch {
                                                        return selectedLog.responseBody
                                                    }
                                                })()}
                                            </pre>
                                        </div>
                                    </div>
                                )}

                                {/* Request Body */}
                                {selectedLog.requestBody && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold text-zinc-300">
                                                Request Body
                                            </h3>
                                            <button
                                                onClick={() => copyToClipboard(selectedLog.requestBody || '')}
                                                className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
                                                title="Copy request body"
                                            >
                                                <Copy className="w-4 h-4 text-zinc-400" />
                                            </button>
                                        </div>
                                        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-4 overflow-x-auto">
                                            <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap">
                                                {(() => {
                                                    try {
                                                        const parsed = JSON.parse(selectedLog.requestBody)
                                                        return JSON.stringify(parsed, null, 2)
                                                    } catch {
                                                        return selectedLog.requestBody
                                                    }
                                                })()}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                                Select a log entry to view details
                            </div>
                        )}
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    )
}
