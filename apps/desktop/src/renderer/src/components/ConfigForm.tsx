import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Settings, FileJson, Upload } from "lucide-react"

interface ConfigFormProps {
    onConfigChange: (port: number, jsonContent: string) => void
}

export function ConfigForm({ onConfigChange }: ConfigFormProps) {
    const [port, setPort] = useState(3000)
    const [jsonContent, setJsonContent] = useState('')

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
                const content = event.target?.result as string
                setJsonContent(content)
                onConfigChange(port, content)
            }
            reader.readAsText(file)
        }
    }

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const content = e.target.value
        setJsonContent(content)
        onConfigChange(port, content)
    }

    const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPort = parseInt(e.target.value) || 0
        setPort(newPort)
        onConfigChange(newPort, jsonContent)
    }

    return (
        <Card className="border-none shadow-xl bg-gray-900/50 backdrop-blur-xl ring-1 ring-white/10 mb-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <Settings className="w-5 h-5 text-blue-400" />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
                        Configuration
                    </span>
                </CardTitle>
                <CardDescription>
                    Setup your local server port and API definition
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="port" className="text-xs font-medium text-blue-300 uppercase tracking-wide">
                        Local Server Port
                    </Label>
                    <Input
                        id="port"
                        type="number"
                        value={port}
                        onChange={handlePortChange}
                        className="bg-black/20 border-white/10 focus-visible:ring-blue-500/50 text-gray-200 placeholder:text-gray-600 font-mono"
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-medium text-blue-300 uppercase tracking-wide">
                        Gateway API Definition (JSON)
                    </Label>

                    <div className="grid gap-4">
                        <div className="relative group">
                            <Input
                                type="file"
                                accept=".json"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                            />
                            <Label
                                htmlFor="file-upload"
                                className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group-hover:scale-[1.01]"
                            >
                                <Upload className="w-6 h-6 text-gray-400 mb-2 group-hover:text-blue-400" />
                                <span className="text-xs text-gray-400 group-hover:text-blue-300">
                                    Click to upload <span className="font-mono text-blue-400">gateway-api.json</span>
                                </span>
                            </Label>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/5" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-gray-900 px-2 text-gray-500">Or paste content</span>
                            </div>
                        </div>

                        <div className="relative">
                            <FileJson className="absolute top-3 left-3 w-4 h-4 text-gray-500 pointer-events-none" />
                            <Textarea
                                value={jsonContent}
                                onChange={handleContentChange}
                                placeholder='{"swagger": "2.0", ...}'
                                className="min-h-[160px] pl-10 bg-black/20 border-white/10 focus-visible:ring-blue-500/50 text-gray-200 placeholder:text-gray-700 font-mono text-xs leading-relaxed"
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
