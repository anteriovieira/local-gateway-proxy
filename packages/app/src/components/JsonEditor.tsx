import React from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

const highlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: '#93c5fd' },   // keys — blue-300
  { tag: tags.string, color: '#86efac' },          // string values — green-300
  { tag: tags.number, color: '#fde68a' },          // numbers — amber-200
  { tag: tags.bool, color: '#c4b5fd' },            // booleans — violet-300
  { tag: tags.null, color: '#a1a1aa' },             // null — zinc-400
  { tag: tags.punctuation, color: '#71717a' },      // braces, brackets, commas — zinc-500
  { tag: tags.separator, color: '#71717a' },        // colons
])

const theme = EditorView.theme({
  '&': {
    fontSize: '11px',
    backgroundColor: '#09090b',
    border: '1px solid #27272a',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  '&.cm-focused': {
    outline: 'none',
    borderColor: '#3f3f46',
  },
  '.cm-scroller': {
    fontFamily: '"Fira Code", "Fira Mono", "Consolas", monospace',
  },
  '.cm-gutters': {
    backgroundColor: '#0c0c0e',
    borderRight: '1px solid #1c1c20',
    color: '#3f3f46',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: '#52525b',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(99,102,241,0.2) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(99,102,241,0.3) !important',
  },
  '.cm-cursor': {
    borderLeftColor: '#a1a1aa',
  },
  '.cm-content': {
    caretColor: '#a1a1aa',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: '#27272a',
    border: 'none',
    color: '#71717a',
  },
  '.cm-tooltip': {
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(99,102,241,0.15)',
    color: 'inherit !important',
    outline: '1px solid rgba(99,102,241,0.3)',
  },
}, { dark: true })

interface JsonEditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
  height?: string
  readOnly?: boolean
  /** When false, disables JSON language mode (no syntax errors for non-JSON content like templates). Defaults to true. */
  jsonLang?: boolean
}

export const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  onChange,
  className,
  height = '100%',
  readOnly = false,
  jsonLang = true,
}) => {
  const extensions = [EditorView.lineWrapping, theme, syntaxHighlighting(highlightStyle)]
  if (jsonLang) {
    extensions.unshift(json())
  }

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="none"
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        bracketMatching: true,
        closeBrackets: true,
        highlightActiveLine: true,
        autocompletion: false,
        searchKeymap: false,
      }}
      readOnly={readOnly}
      className={className}
      height={height}
    />
  )
}
