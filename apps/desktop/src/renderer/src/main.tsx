import React from 'react'
import ReactDOM from 'react-dom/client'
import { App, ProxyProvider, createElectronAdapter } from '@proxy-app/app'
import './index.css'

const adapter = createElectronAdapter()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ProxyProvider adapter={adapter}>
      <App nativeWindowDrag />
    </ProxyProvider>
  </React.StrictMode>
)
