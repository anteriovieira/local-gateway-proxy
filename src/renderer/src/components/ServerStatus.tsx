import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Play, Square, Terminal, Activity } from "lucide-react"

interface ServerStatusProps {
    isRunning: boolean
    port: number
    onToggle: () => void
    logs: string[]
}

export function ServerStatus({ isRunning, port, onToggle, logs }: ServerStatusProps) {
    return (
        <Card className="h-full flex flex-col border-none shadow-xl bg-gray-900/50 backdrop-blur-xl ring-1 ring-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-green-400">
                        Server Status
                    </CardTitle>
                    <CardDescription>
                        Control and monitor your local proxy
                    </CardDescription>
                </div>
                <Badge
                    variant={isRunning ? "default" : "destructive"}
                    className={`px-4 py-1.5 text-sm transition-all duration-300 ${isRunning
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/50'
                            : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border-rose-500/50'
                        }`}
                >
                    <Activity className="w-3 h-3 mr-2 animate-pulse" />
                    {isRunning ? 'RUNNING' : 'STOPPED'}
                </Badge>
            </CardHeader>
            <CardContent className="space-y-6 flex-1 flex flex-col pt-6">
                <Button
                    onClick={onToggle}
                    className={`w-full h-12 text-base font-semibold transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] ${isRunning
                            ? 'bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 shadow-rose-500/20'
                            : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 shadow-emerald-500/20'
                        } shadow-lg border-0`}
                    size="lg"
                >
                    {isRunning ? (
                        <>
                            <Square className="w-5 h-5 mr-2 fill-current" />
                            Stop Server
                        </>
                    ) : (
                        <>
                            <Play className="w-5 h-5 mr-2 fill-current" />
                            Start Server on Port {port}
                        </>
                    )}
                </Button>

                <div className="flex flex-col flex-1 min-h-[300px] bg-black/40 rounded-xl border border-white/5 overflow-hidden">
                    <div className="flex items-center px-4 py-2 border-b border-white/5 bg-white/5">
                        <Terminal className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">Live Logs</span>
                    </div>
                    <ScrollArea className="flex-1 p-4 font-mono text-xs">
                        {logs.length === 0 ? (
                            <div className="text-gray-500 italic text-center mt-10">Waiting for events...</div>
                        ) : (
                            <div className="space-y-1.5">
                                {logs.map((log, i) => (
                                    <div key={i} className="text-gray-300 break-all pl-2 border-l-2 border-blue-500/30">
                                        <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                                        {log}
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </CardContent>
        </Card>
    )
}
