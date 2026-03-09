import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '../../utils'

interface CopyButtonProps {
    text: string
    className?: string
    iconSize?: string
    title?: string
    variant?: 'default' | 'inline'
}

export const CopyButton: React.FC<CopyButtonProps> = ({
    text,
    className,
    iconSize = 'w-4 h-4',
    title,
    variant = 'default'
}) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            // Reset to copy icon after 2 seconds
            setTimeout(() => {
                setCopied(false)
            }, 2000)
        } catch (err) {
            console.error('Failed to copy text:', err)
        }
    }

    if (variant === 'inline') {
        return (
            <button
                onClick={handleCopy}
                className={cn(
                    "flex items-center gap-1 cursor-pointer transition-colors",
                    className
                )}
                title={title || 'Copy to clipboard'}
            >
                <span>{text}</span>
                {copied ? (
                    <Check className={cn(iconSize, "text-green-400")} />
                ) : (
                    <Copy className={iconSize} />
                )}
            </button>
        )
    }

    return (
        <button
            onClick={handleCopy}
            className={cn(
                "p-1.5 hover:bg-zinc-800 rounded transition-colors cursor-pointer",
                className
            )}
            title={title || 'Copy to clipboard'}
        >
            {copied ? (
                <Check className={cn(iconSize, "text-green-400")} />
            ) : (
                <Copy className={cn(iconSize, "text-zinc-400")} />
            )}
        </button>
    )
}
