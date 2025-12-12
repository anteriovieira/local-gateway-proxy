import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { EndpointDef } from '../../types'
import { cn } from '../../utils'
import { Check, Search } from 'lucide-react'

interface EndpointListProps {
    endpoints: EndpointDef[]
    onToggle: (index: number) => void
    onEndpointClick?: (path: string) => void
}

const METHODS = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const
const ITEM_HEIGHT = 56 // Height of each endpoint item including spacing

interface EndpointItem {
    endpoint: EndpointDef
    originalIndex: number
}

export const EndpointList: React.FC<EndpointListProps> = ({ endpoints, onToggle, onEndpointClick }) => {
    const [searchQuery, setSearchQuery] = useState('')
    const [methodFilter, setMethodFilter] = useState<string>('ALL')
    const parentRef = useRef<HTMLDivElement>(null)

    const filteredEndpoints = useMemo(() => {
        return endpoints
            .map((ep, originalIndex) => ({ endpoint: ep, originalIndex }))
            .filter(({ endpoint: ep }) => {
                const matchesSearch = ep.path.toLowerCase().includes(searchQuery.toLowerCase())
                const matchesMethod = methodFilter === 'ALL' || ep.method.toUpperCase() === methodFilter
                return matchesSearch && matchesMethod
            })
    }, [endpoints, searchQuery, methodFilter])

    const virtualizer = useVirtualizer({
        count: filteredEndpoints.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ITEM_HEIGHT,
        overscan: 5, // Render 5 extra items outside viewport for smooth scrolling
    })

    // Scroll to top when filter changes
    useEffect(() => {
        if (virtualizer) {
            virtualizer.scrollToIndex(0, { align: 'start' })
        }
    }, [searchQuery, methodFilter, virtualizer])

    if (endpoints.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 p-8 border border-dashed border-zinc-800 rounded-lg">
                <p>No endpoints configured</p>
                <p className="text-xs mt-1">Paste a config to get started</p>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Search and Filter Bar */}
            <div className="flex items-center gap-2 mb-3 shrink-0">
                <div className="flex-1 relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search endpoints..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-md text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
                    />
                </div>
                <div className="flex gap-1">
                    {METHODS.map(method => (
                        <button
                            key={method}
                            onClick={() => setMethodFilter(method)}
                            className={cn(
                                "px-2 py-1 text-[10px] font-mono rounded transition-colors",
                                methodFilter === method
                                    ? method === 'ALL'
                                        ? "bg-zinc-700 text-white"
                                        : getMethodBgColor(method)
                                    : "bg-zinc-900 text-zinc-500 hover:bg-zinc-800"
                            )}
                        >
                            {method}
                        </button>
                    ))}
                </div>
            </div>


            {/* Endpoint List */}
            <div ref={parentRef} className="flex-1 overflow-auto pr-2 custom-scrollbar">
                {filteredEndpoints.length === 0 ? (
                    <div className="text-center text-zinc-600 text-xs py-8">
                        No endpoints match your filter
                    </div>
                ) : (
                    <div
                        style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {virtualizer.getVirtualItems().map((virtualItem) => {
                            const item = filteredEndpoints[virtualItem.index]
                            if (!item) return null

                            const { endpoint: ep, originalIndex } = item

                            return (
                                <div
                                    key={virtualItem.key}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualItem.size}px`,
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                >
                                    <div
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-md border text-sm transition-all mx-1 mb-1",
                                            ep.enabled !== false
                                                ? "bg-zinc-900/50 border-zinc-800 text-zinc-200"
                                                : "bg-zinc-950 border-zinc-900 text-zinc-600 opacity-60"
                                        )}
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onToggle(originalIndex)
                                            }}
                                            className={cn(
                                                "w-5 h-5 rounded flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 shrink-0",
                                                ep.enabled !== false ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-600"
                                            )}
                                        >
                                            {ep.enabled !== false && <Check className="w-3.5 h-3.5" />}
                                        </button>

                                        <span className={cn(
                                            "font-mono font-bold px-2 py-0.5 rounded text-[10px] w-14 text-center select-none shrink-0",
                                            getMethodColor(ep.method)
                                        )}>
                                            {ep.method.toUpperCase()}
                                        </span>

                                        <button
                                            onClick={() => onEndpointClick?.(ep.path)}
                                            className={cn(
                                                "font-mono truncate flex-1 text-left hover:text-purple-400 transition-colors",
                                                onEndpointClick && "cursor-pointer"
                                            )}
                                            title={onEndpointClick ? `Click to filter logs by ${ep.path}` : ep.path}
                                        >
                                            {ep.path}
                                        </button>

                                        <span className="text-xs text-zinc-500 font-mono truncate max-w-[200px]" title={ep.uriTemplate}>
                                            → {ep.uriTemplate}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

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

function getMethodBgColor(method: string) {
    switch (method.toLowerCase()) {
        case 'get': return 'bg-sky-500/20 text-sky-400'
        case 'post': return 'bg-emerald-500/20 text-emerald-400'
        case 'put': return 'bg-amber-500/20 text-amber-400'
        case 'delete': return 'bg-red-500/20 text-red-400'
        case 'patch': return 'bg-purple-500/20 text-purple-400'
        default: return 'bg-zinc-500/20 text-zinc-400'
    }
}
