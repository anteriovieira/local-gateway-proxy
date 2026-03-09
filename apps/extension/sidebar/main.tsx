import React from 'react'
import ReactDOM from 'react-dom/client'
import { App, ProxyProvider, createChromeAdapter } from '@proxy-app/app'
import './index.css'

const adapter = createChromeAdapter()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ProxyProvider adapter={adapter}>
      <App nativeWindowDrag={false} variant="extension" />
    </ProxyProvider>
  </React.StrictMode>
)
