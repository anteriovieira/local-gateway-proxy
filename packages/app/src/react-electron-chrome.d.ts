import 'react'

declare module 'react' {
  interface CSSProperties {
    /** Electron / WebKit: `-webkit-app-region` for frameless window chrome */
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}
