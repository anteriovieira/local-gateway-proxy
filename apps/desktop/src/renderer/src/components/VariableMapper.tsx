import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ExternalLink } from "lucide-react"

interface VariableMapperProps {
    variables: Record<string, string>
    onVariableChange: (key: string, value: string) => void
}

export function VariableMapper({ variables, onVariableChange }: VariableMapperProps) {
    const variableKeys = Object.keys(variables)

    if (variableKeys.length === 0) {
        return null
    }

    return (
        <Card className="border-none shadow-xl bg-gray-900/50 backdrop-blur-xl ring-1 ring-white/10">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <ExternalLink className="w-5 h-5 text-purple-400" />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                        Variable Mapping
                    </span>
                </CardTitle>
                <CardDescription>
                    Map stage variables to local or remote URLs
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {variableKeys.map((key) => (
                    <div key={key} className="space-y-2">
                        <Label className="text-xs font-medium text-purple-300 uppercase tracking-wide">
                            {key}
                        </Label>
                        <Input
                            type="text"
                            value={variables[key]}
                            onChange={(e) => onVariableChange(key, e.target.value)}
                            placeholder="http://localhost:..."
                            className="bg-black/20 border-white/10 focus-visible:ring-purple-500/50 text-gray-200 placeholder:text-gray-600"
                        />
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
