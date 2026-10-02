import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@proxy-app/ui'

/**
 * Read-only JSON viewer where every object/array can be collapsed or expanded.
 * Click a toggle to flip one node; Alt+click flips the node and all of its descendants.
 * Bump `command.id` to expand or collapse the whole tree from outside.
 */

export interface JsonViewCommand {
  id: number
  expand: boolean
}

interface JsonViewProps {
  value: unknown
  command?: JsonViewCommand
  className?: string
}

// Same palette as the CodeMirror JsonEditor
const KEY = 'text-blue-300'
const PUNCT = 'text-zinc-500'
const scalarClass = (v: unknown) =>
  typeof v === 'string'
    ? 'text-green-300'
    : typeof v === 'number'
      ? 'text-amber-200'
      : typeof v === 'boolean'
        ? 'text-violet-300'
        : 'text-zinc-400'

let commandSeq = 0
const nextCommand = (expand: boolean): JsonViewCommand => ({ id: ++commandSeq, expand })

const latest = (a?: JsonViewCommand, b?: JsonViewCommand) => (!a ? b : !b ? a : a.id >= b.id ? a : b)

interface NodeProps {
  name?: string
  value: unknown
  isLast: boolean
  command?: JsonViewCommand
}

const JsonNode: React.FC<NodeProps> = ({ name, value, isLast, command }) => {
  const [open, setOpen] = useState(command ? command.expand : true)
  const [appliedId, setAppliedId] = useState(command?.id)
  // Subtree command from an Alt+click on this node; overrides the parent's when newer
  const [ownCommand, setOwnCommand] = useState<JsonViewCommand>()

  if (command && command.id !== appliedId) {
    setAppliedId(command.id)
    setOpen(command.expand)
  }

  const comma = isLast ? null : <span className={PUNCT}>,</span>
  const label =
    name !== undefined ? (
      <>
        <span className={KEY}>{JSON.stringify(name)}</span>
        <span className={PUNCT}>: </span>
      </>
    ) : null

  if (value === null || typeof value !== 'object') {
    return (
      <div className="pl-4 break-all">
        {label}
        <span className={scalarClass(value)}>{value === undefined ? 'undefined' : JSON.stringify(value)}</span>
        {comma}
      </div>
    )
  }

  const isArray = Array.isArray(value)
  const entries: [string | undefined, unknown][] = isArray
    ? (value as unknown[]).map((v) => [undefined, v])
    : Object.entries(value as Record<string, unknown>)
  const [openBrace, closeBrace] = isArray ? ['[', ']'] : ['{', '}']

  if (entries.length === 0) {
    return (
      <div className="pl-4 break-all">
        {label}
        <span className={PUNCT}>{openBrace + closeBrace}</span>
        {comma}
      </div>
    )
  }

  const toggle = (e: React.MouseEvent) => {
    const expand = !open
    setOpen(expand)
    if (e.altKey) setOwnCommand(nextCommand(expand))
  }
  const childCommand = latest(command, ownCommand)

  return (
    <div className="pl-4">
      <div className="relative break-all">
        <button
          onClick={toggle}
          className="absolute -left-4 top-0.5 p-px rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
          title={open ? 'Collapse (Alt+click: collapse all inside)' : 'Expand (Alt+click: expand all inside)'}
        >
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {label}
        {open ? (
          <span className={PUNCT}>{openBrace}</span>
        ) : (
          <button onClick={toggle} className="hover:bg-zinc-800 rounded">
            <span className={PUNCT}>{openBrace}</span>
            <span className="px-1 text-zinc-600">
              {entries.length} {isArray ? (entries.length === 1 ? 'item' : 'items') : entries.length === 1 ? 'key' : 'keys'}
            </span>
            <span className={PUNCT}>{closeBrace}</span>
          </button>
        )}
        {!open && comma}
      </div>
      {open && (
        <>
          {entries.map(([k, v], i) => (
            <JsonNode key={k ?? i} name={k} value={v} isLast={i === entries.length - 1} command={childCommand} />
          ))}
          <div>
            <span className={PUNCT}>{closeBrace}</span>
            {comma}
          </div>
        </>
      )}
    </div>
  )
}

export const JsonView: React.FC<JsonViewProps> = ({ value, command, className }) => (
  <div className={cn('text-xs font-mono leading-5', className)}>
    <JsonNode value={value} isLast command={command} />
  </div>
)

export const useJsonViewCommand = () => {
  const [command, setCommand] = useState<JsonViewCommand>()
  return {
    command,
    expandAll: () => setCommand(nextCommand(true)),
    collapseAll: () => setCommand(nextCommand(false)),
  }
}

export const tryParseJson = (text?: string): { ok: true; value: unknown } | { ok: false } => {
  if (!text) return { ok: false }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false }
  }
}
