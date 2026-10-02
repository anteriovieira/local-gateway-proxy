import React, { useState } from 'react'
import type { ApiLogEntry } from '@proxy-app/shared'
import {
  MoreHorizontal,
  Plus,
  Server,
  Link,
  Copy,
  Code,
  FileJson,
  ExternalLink,
  Filter,
  Hash,
  Split,
  Loader2,
  Terminal,
  Eye,
  EyeOff,
} from 'lucide-react'
import {
  CopyButton,
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@proxy-app/ui'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-json'

type HeaderRow = [string, string]

const headerRows = (headers?: Record<string, string>) => Object.entries(headers || {}) as HeaderRow[]
const headersAsText = (rows: HeaderRow[]) => rows.map(([k, v]) => `${k}: ${v}`).join('\n')

export const logUrl = (log: ApiLogEntry) => log.requestUrl || log.targetUrl || log.path

const parseLogUrl = (log: ApiLogEntry) => {
  try {
    return new URL(logUrl(log))
  } catch {
    return null
  }
}

const findHeader = (headers: Record<string, string> | undefined, name: string) =>
  headerRows(headers).find(([k]) => k.toLowerCase() === name)?.[1]

const formatBytes = (s: string) => {
  const n = new Blob([s]).size
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`
}

const formatDuration = (ms?: number) => (ms === undefined ? undefined : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`)

const formatClock = (ts: string) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

const shellQuote = (s: string) => `'${s.replace(/'/g, "'\\''")}'`

const toCurl = (log: ApiLogEntry) => {
  const parts = [`curl -X ${log.method} ${shellQuote(logUrl(log))}`]
  headerRows(log.requestHeaders).forEach(([k, v]) => parts.push(`  -H ${shellQuote(`${k}: ${v}`)}`))
  if (log.requestBody) parts.push(`  --data-raw ${shellQuote(log.requestBody)}`)
  return parts.join(' \\\n')
}

const toFetch = (log: ApiLogEntry) => {
  const init: Record<string, unknown> = { method: log.method }
  if (log.requestHeaders && Object.keys(log.requestHeaders).length > 0) init.headers = log.requestHeaders
  if (log.requestBody) init.body = log.requestBody
  return `await fetch(${JSON.stringify(logUrl(log))}, ${JSON.stringify(init, null, 2)})`
}

const copyText = (text: string) => {
  navigator.clipboard.writeText(text).catch((err) => console.error('Failed to copy text:', err))
}

const renderJsonHtml = (body: string) => {
  try {
    return highlight(JSON.stringify(JSON.parse(body), null, 2), languages.json, 'json')
  } catch {
    return body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
}

const statusBadgeColor = (log: ApiLogEntry) => {
  if (log.status === 'pending') return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  if (log.status === 'error') return 'bg-red-500/20 text-red-400 border-red-500/30'
  if (log.statusCode === undefined) return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  if (log.statusCode >= 200 && log.statusCode < 300) return 'bg-green-500/20 text-green-400 border-green-500/30'
  if (log.statusCode >= 400) return 'bg-red-500/20 text-red-400 border-red-500/30'
  return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
}

const METHOD_TEXT_COLOR: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-400',
  POST: 'bg-blue-500/20 text-blue-400',
  PUT: 'bg-amber-500/20 text-amber-400',
  PATCH: 'bg-violet-500/20 text-violet-400',
  DELETE: 'bg-red-500/20 text-red-400',
}

// ---------------------------------------------------------------------------
// Header: address bar (method | URL | copy | actions menu) + status line
// ---------------------------------------------------------------------------

interface LogDetailHeaderProps {
  log: ApiLogEntry
  inDefinitions: boolean
  onAddToDefinitions?: (log: ApiLogEntry) => void
  onCreateMock?: (log: ApiLogEntry) => void
  onFilterEndpoint?: (path: string) => void
}

const MENU_ITEM = 'text-xs text-zinc-300'
const MENU_ICON = 'w-3.5 h-3.5 text-zinc-400'

export const LogDetailHeader: React.FC<LogDetailHeaderProps> = ({ log, inDefinitions, onAddToDefinitions, onCreateMock, onFilterEndpoint }) => {
  const url = parseLogUrl(log)
  const canAddToDefinitions = !!onAddToDefinitions && !inDefinitions
  const canCreateMock = !!onCreateMock && !!log.responseBody && !log.isMock && !inDefinitions
  const canOpen = !!url && /^https?:$/.test(url.protocol) && log.method.toUpperCase() === 'GET'
  const duration = formatDuration(log.duration)

  return (
    <div className="shrink-0 mb-3 space-y-2">
      <div className="flex items-stretch rounded-md border border-zinc-700 bg-zinc-900/80 overflow-hidden">
        <span
          className={cn(
            'px-2.5 flex items-center text-xs font-semibold font-mono border-r border-zinc-700',
            METHOD_TEXT_COLOR[log.method.toUpperCase()] ?? 'bg-zinc-500/20 text-zinc-300'
          )}
        >
          {log.method}
        </span>
        <p className="flex-1 min-w-0 px-3 py-2 text-xs font-mono break-all">
          {url ? (
            <>
              <span className="text-zinc-500">{url.origin}</span>
              <span className="text-zinc-100">{url.pathname}</span>
              <span className="text-zinc-500">{url.search}</span>
            </>
          ) : (
            <span className="text-zinc-100">{logUrl(log)}</span>
          )}
        </p>
        <CopyButton text={logUrl(log)} title="Copy URL" iconSize="w-3.5 h-3.5" className="rounded-none px-2" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="px-2 border-l border-zinc-700 hover:bg-zinc-800 transition-colors" title="More actions">
              <MoreHorizontal className="w-4 h-4 text-zinc-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {(canAddToDefinitions || canCreateMock) && (
              <>
                {canAddToDefinitions && (
                  <DropdownMenuItem onClick={() => onAddToDefinitions!(log)} className={MENU_ITEM}>
                    <Plus className="w-3.5 h-3.5 text-blue-400" /> Add to Definitions
                  </DropdownMenuItem>
                )}
                {canCreateMock && (
                  <DropdownMenuItem onClick={() => onCreateMock!(log)} className={MENU_ITEM}>
                    <Server className="w-3.5 h-3.5 text-violet-400" /> Create Mock
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Copy</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => copyText(logUrl(log))} className={MENU_ITEM}>
              <Link className={MENU_ICON} /> URL
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copyText(`${log.method} ${log.path}`)} className={MENU_ITEM}>
              <Copy className={MENU_ICON} /> Method + path
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copyText(toCurl(log))} className={MENU_ITEM}>
              <Terminal className={MENU_ICON} /> as cURL
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copyText(toFetch(log))} className={MENU_ITEM}>
              <Code className={MENU_ICON} /> as fetch
            </DropdownMenuItem>
            {log.responseBody && (
              <DropdownMenuItem onClick={() => copyText(log.responseBody!)} className={MENU_ITEM}>
                <FileJson className={MENU_ICON} /> Response body
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => copyText(log.id)} className={MENU_ITEM}>
              <Hash className={MENU_ICON} /> Request ID
            </DropdownMenuItem>
            {(canOpen || onFilterEndpoint) && <DropdownMenuSeparator />}
            {canOpen && (
              <DropdownMenuItem onClick={() => window.open(url!.href, '_blank', 'noopener')} className={MENU_ITEM}>
                <ExternalLink className={MENU_ICON} /> Open in new tab
              </DropdownMenuItem>
            )}
            {onFilterEndpoint && (
              <DropdownMenuItem onClick={() => onFilterEndpoint(log.path)} className={MENU_ITEM}>
                <Filter className={MENU_ICON} /> Show only this endpoint
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('px-2 py-0.5 text-[10px] font-medium rounded border flex items-center gap-1', statusBadgeColor(log))}>
          {log.status === 'pending' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
          {log.status === 'pending' ? 'Pending' : log.status === 'error' ? 'Error' : (log.statusCode ?? '?')}
          {log.statusCode && log.statusCode >= 200 && log.statusCode < 300 ? ' OK' : ''}
        </span>
        {log.isMock ? (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-violet-500/20 text-violet-400 border border-violet-500/30">MOCK</span>
        ) : log.isBypass ? (
          <span className="flex items-center gap-1 text-[10px] text-amber-400">
            <Split className="w-3 h-3 rotate-90" />
            Bypass
          </span>
        ) : null}
        {duration && <span className="text-xs text-zinc-400">{duration}</span>}
        <span className="text-xs text-zinc-600">{formatClock(log.timestamp)}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Body viewer
// ---------------------------------------------------------------------------

export const BodyView: React.FC<{ title: string; body?: string; empty: string }> = ({ title, body, empty }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>
      {body && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">{formatBytes(body)}</span>
          <CopyButton text={body} title={`Copy ${title.toLowerCase()}`} />
        </div>
      )}
    </div>
    <div className="bg-zinc-900/80 border border-zinc-700 rounded-md p-4 overflow-auto max-h-[320px] custom-scrollbar">
      {body ? (
        <pre className="text-xs font-mono whitespace-pre-wrap language-json" dangerouslySetInnerHTML={{ __html: renderJsonHtml(body) }} />
      ) : (
        <p className="text-xs text-zinc-500 italic">{empty}</p>
      )}
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Shared table pieces
// ---------------------------------------------------------------------------

const TD = 'px-3 py-2 font-mono break-all align-top'

const SectionTitle: React.FC<{ title: string; count: number; copyText: string }> = ({ title, count, copyText }) => (
  <div className="flex items-center justify-between gap-2">
    <div className="text-xs font-medium text-zinc-400">
      {title}
      <span className="ml-1.5 text-zinc-600">{count}</span>
    </div>
    <CopyButton text={copyText} iconSize="w-3.5 h-3.5" title={`Copy ${title.toLowerCase()}`} />
  </div>
)

const RowCopy: React.FC<{ text: string; name: string }> = ({ text, name }) => (
  <CopyButton text={text} iconSize="w-3 h-3" className="p-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100" title={`Copy ${name}`} />
)

// ---------------------------------------------------------------------------
// Headers tab: grouped by purpose, sensitive values masked
// ---------------------------------------------------------------------------

const HEADER_GROUPS: { name: string; test: RegExp }[] = [
  { name: 'Auth', test: /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|x-auth|x-csrf|x-xsrf)/ },
  { name: 'Content', test: /^(content-|accept|transfer-encoding)/ },
  { name: 'Caching', test: /^(cache-control|etag|expires|last-modified|age|pragma|vary|if-)/ },
  { name: 'CORS', test: /^(access-control-|origin$|referer$|sec-fetch-|timing-allow-origin)/ },
  { name: 'Client', test: /^(user-agent|sec-ch-|host$|connection$|x-forwarded-|x-real-ip|dnt$)/ },
]
const HEADER_GROUP_ORDER = [...HEADER_GROUPS.map((g) => g.name), 'Other']
const SENSITIVE_HEADER = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|x-auth-token|x-csrf-token|x-xsrf-token)$/

const headerGroup = (name: string) => HEADER_GROUPS.find((g) => g.test.test(name.toLowerCase()))?.name ?? 'Other'

const MaskedValue: React.FC<{ value: string }> = ({ value }) => {
  const [revealed, setRevealed] = useState(false)
  return (
    <span className="inline-flex items-start gap-1">
      <span className={cn(!revealed && 'tracking-widest text-zinc-600')}>{revealed ? value : '•'.repeat(Math.min(24, value.length))}</span>
      <button onClick={() => setRevealed(!revealed)} className="p-0.5 text-zinc-500 hover:text-zinc-300 shrink-0" title={revealed ? 'Hide' : 'Reveal'}>
        {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>
    </span>
  )
}

const GroupedHeadersTable: React.FC<{ title: string; rows: HeaderRow[] }> = ({ title, rows }) => {
  const groups = HEADER_GROUP_ORDER.map((name) => [name, rows.filter(([k]) => headerGroup(k) === name)] as const).filter(([, r]) => r.length > 0)
  return (
    <div className="space-y-2">
      <SectionTitle title={title} count={rows.length} copyText={headersAsText(rows)} />
      <div className="overflow-x-auto rounded border border-zinc-700">
        <table className="w-full text-xs">
          <tbody>
            {groups.map(([name, groupRows]) => (
              <React.Fragment key={name}>
                <tr className="bg-zinc-800/50 border-b border-zinc-700">
                  <td colSpan={2} className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {name}
                  </td>
                </tr>
                {groupRows.map(([k, v]) => (
                  <tr key={k} className="group border-b border-zinc-800/50 last:border-0">
                    <td className={cn(TD, 'text-zinc-300 w-[35%]')}>{k}</td>
                    <td className={cn(TD, 'text-zinc-400')}>
                      <div className="flex items-start gap-1">
                        <span className="flex-1 min-w-0">{SENSITIVE_HEADER.test(k.toLowerCase()) ? <MaskedValue value={v} /> : v}</span>
                        <RowCopy text={v} name={k} />
                      </div>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const HeadersSection: React.FC<{ log: ApiLogEntry }> = ({ log }) => {
  const requestHeaders = headerRows(log.requestHeaders)
  const responseHeaders = headerRows(log.responseHeaders)
  if (requestHeaders.length === 0 && responseHeaders.length === 0) {
    return <p className="text-xs text-zinc-500 italic">No headers captured</p>
  }
  return (
    <div className="space-y-6">
      {requestHeaders.length > 0 && <GroupedHeadersTable title="Request Headers" rows={requestHeaders} />}
      {responseHeaders.length > 0 && <GroupedHeadersTable title="Response Headers" rows={responseHeaders} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Request tab: URL + key header chips, query parameters, body
// ---------------------------------------------------------------------------

export const RequestSection: React.FC<{ log: ApiLogEntry }> = ({ log }) => {
  const url = parseLogUrl(log)
  const queryParams = Array.from(url?.searchParams.entries() ?? [])
  const chips = [
    ['Host', url?.host],
    ['Content-Type', findHeader(log.requestHeaders, 'content-type')],
    ['Accept', findHeader(log.requestHeaders, 'accept')],
    ['Size', log.requestBody ? formatBytes(log.requestBody) : undefined],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="group flex items-start gap-1">
          <p className="text-xs font-mono text-zinc-300 break-all">
            {url ? (
              <>
                <span className="text-zinc-500">{url.origin}</span>
                {url.pathname + url.search}
              </>
            ) : (
              logUrl(log)
            )}
          </p>
          <CopyButton text={logUrl(log)} iconSize="w-3 h-3" className="p-1 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Copy URL" />
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map(([k, v]) => (
              <span key={k} className="px-2 py-0.5 text-[10px] rounded border border-zinc-700 bg-zinc-900 text-zinc-400">
                <span className="text-zinc-600">{k}</span> <span className="font-mono text-zinc-300">{v}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {queryParams.length > 0 && (
        <div className="space-y-2">
          <SectionTitle title="Query Parameters" count={queryParams.length} copyText={queryParams.map(([k, v]) => `${k}=${v}`).join('\n')} />
          <div className="overflow-x-auto rounded border border-zinc-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-800/50">
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">Key</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">Value</th>
                </tr>
              </thead>
              <tbody>
                {queryParams.map(([k, v], i) => (
                  <tr key={`${k}-${i}`} className="group border-b border-zinc-800/50 last:border-0">
                    <td className={cn(TD, 'text-zinc-300 w-[35%]')}>{k}</td>
                    <td className={cn(TD, 'text-zinc-400')}>
                      <div className="flex items-start gap-1">
                        <span className="flex-1 min-w-0">{v}</span>
                        <RowCopy text={v} name={k} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <BodyView title="Request Body" body={log.requestBody} empty="No request body (GET requests typically have no body)" />
    </div>
  )
}
