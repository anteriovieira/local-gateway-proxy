import React, { createContext, useContext } from 'react'
import type { ProxyAdapter } from './ProxyAdapter'

const ProxyContext = createContext<ProxyAdapter | null>(null)

export function ProxyProvider({
  adapter,
  children,
}: {
  adapter: ProxyAdapter
  children: React.ReactNode
}) {
  return (
    <ProxyContext.Provider value={adapter}>
      {children}
    </ProxyContext.Provider>
  )
}

export function useProxyAdapter(): ProxyAdapter {
  const adapter = useContext(ProxyContext)
  if (!adapter) {
    throw new Error('useProxyAdapter must be used within ProxyProvider')
  }
  return adapter
}
