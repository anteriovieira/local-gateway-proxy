import React from 'react'
import Editor from 'react-simple-code-editor'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-json'
import 'prismjs/themes/prism-tomorrow.css'

interface JsonEditorProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
}

export const JsonEditor: React.FC<JsonEditorProps> = ({ value, onChange, placeholder }) => {
    return (
        <div className="h-full overflow-auto custom-scrollbar bg-zinc-950">
            <Editor
                value={value}
                onValueChange={onChange}
                highlight={code => {
                    try {
                        return highlight(code, languages.json, 'json')
                    } catch {
                        return code
                    }
                }}
                padding={16}
                placeholder={placeholder}
                textareaClassName="focus:outline-none"
                style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    fontSize: 12,
                    minHeight: '100%',
                    backgroundColor: 'transparent',
                    color: '#a1a1aa'
                }}
            />
        </div>
    )
}
