/**
 * Function injected into the page's main world via chrome.scripting.executeScript.
 * Runs in MAIN world so it can patch the page's fetch/XHR.
 * PREFIX and MAX are passed as args (no closure) for serialization.
 */
export function injectFetchPatch(PREFIX: string, MAX: number): void {
    function path(u: string): string {
      try {
        return new URL(u).pathname
      } catch {
        return ''
      }
    }
    const pendingFetches: Record<number, (r: unknown) => void> = {}
    let nextId = 1

    window.addEventListener('message', (e: MessageEvent) => {
      if (e.source !== window || !e.data?.type || e.data.type !== PREFIX + 'fetch-result') return
      const id = e.data.id
      if (id != null && pendingFetches[id]) {
        pendingFetches[id](e.data.result)
        delete pendingFetches[id]
      }
    })

    const origFetch = window.fetch
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
      const method = ((init?.method ?? (input instanceof Request ? input.method : 'GET')) || 'GET').toUpperCase()

      try {
        const req = input instanceof Request ? input : new Request(input, init)
        const headers: Record<string, string> = {}
        req.headers.forEach((v, k) => {
          headers[k] = v
        })
        const body = req.body ? await req.clone().arrayBuffer() : null
        const id = nextId++
        const r = await new Promise<unknown>((resolve) => {
          pendingFetches[id] = resolve
          window.postMessage({ type: PREFIX + 'fetch', id, url, method, headers, body }, '*')
          setTimeout(() => {
            if (pendingFetches[id]) {
              delete pendingFetches[id]
              resolve({ proxied: false })
            }
          }, 30000)
        })
        const res = r as { proxied?: boolean; status?: number; statusText?: string; headers?: Record<string, string>; body?: ArrayBuffer }
        if (res?.proxied && res.status !== undefined) {
          return new Response(res.body ?? null, {
            status: res.status,
            statusText: res.statusText ?? '',
            headers: res.headers ?? {},
          })
        }
      } catch {
        // fall through
      }

      const response = await origFetch.apply(this, arguments as unknown as [RequestInfo | URL, RequestInit?])
      try {
        const clone = response.clone()
        const text = await clone.text()
        const respUrl = response.url || url
        if (text && text.length <= MAX) {
          window.postMessage(
            {
              type: PREFIX + 'response-body',
              payload: { url: respUrl, method, pathname: path(respUrl), body: text, timestamp: Date.now() },
            },
            '*'
          )
        }
      } catch {
        // ignore
      }
      return response
    }

    const XHR = window.XMLHttpRequest
    const origOpen = XHR.prototype.open
    const origSend = XHR.prototype.send
    const origSetRequestHeader = XHR.prototype.setRequestHeader

    XHR.prototype.open = function (method: string, url: string) {
      ;(this as unknown as { __cu: string; __cm: string; __xhrHeaders: Record<string, string> }).__cu = url
      ;(this as unknown as { __cu: string; __cm: string; __xhrHeaders: Record<string, string> }).__cm = (method || 'GET').toUpperCase()
      ;(this as unknown as { __cu: string; __cm: string; __xhrHeaders: Record<string, string> }).__xhrHeaders = {}
      return origOpen.apply(this, arguments as unknown as [string, string, boolean])
    }

    XHR.prototype.setRequestHeader = function (name: string, value: string) {
      const h = (this as unknown as { __xhrHeaders: Record<string, string> }).__xhrHeaders
      if (h) h[name.toLowerCase()] = value
      return origSetRequestHeader.call(this, name, value)
    }

    XHR.prototype.send = function (...args: unknown[]) {
      const x = this
      const u = (x as unknown as { __cu: string }).__cu
      const m = (x as unknown as { __cm: string }).__cm || 'GET'
      const capturedHeaders: Record<string, string> = (x as unknown as { __xhrHeaders: Record<string, string> }).__xhrHeaders || {}

      // Convert body to ArrayBuffer for transfer if possible
      let bodyToSend: ArrayBuffer | null = null
      const rawBody = args[0]
      if (rawBody != null) {
        if (rawBody instanceof ArrayBuffer) {
          bodyToSend = rawBody
        } else if (typeof rawBody === 'string') {
          try { bodyToSend = new TextEncoder().encode(rawBody).buffer } catch { /* ignore */ }
        }
      }

      const id = nextId++

      pendingFetches[id] = (r: unknown) => {
        const res = r as { proxied?: boolean; status?: number; statusText?: string; headers?: Record<string, string>; body?: ArrayBuffer }
        if (res?.proxied && res.status !== undefined) {
          // Inject proxied response into XHR without sending to the original URL
          let responseText = ''
          try {
            if (res.body) responseText = new TextDecoder().decode(res.body)
          } catch { /* ignore */ }

          const status = res.status
          const statusText = res.statusText || ''
          const totalBytes = responseText.length

          const def = (name: string, value: unknown) => {
            Object.defineProperty(x, name, { get: () => value, configurable: true, enumerable: true })
          }
          def('status', status)
          def('statusText', statusText)
          def('response', responseText)
          def('responseText', responseText)
          def('responseURL', u || '')

          const headerStr = Object.entries(res.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\r\n')
          ;(x as unknown as { getAllResponseHeaders: () => string }).getAllResponseHeaders = () => headerStr

          // Fire XHR state transitions asynchronously
          Promise.resolve().then(() => {
            def('readyState', 2)
            x.dispatchEvent(new Event('readystatechange'))
            def('readyState', 3)
            x.dispatchEvent(new ProgressEvent('progress', { loaded: totalBytes, total: totalBytes, lengthComputable: true }))
            x.dispatchEvent(new Event('readystatechange'))
            def('readyState', 4)
            x.dispatchEvent(new Event('readystatechange'))
            x.dispatchEvent(new ProgressEvent('load', { loaded: totalBytes, total: totalBytes, lengthComputable: true }))
            x.dispatchEvent(new ProgressEvent('loadend', { loaded: totalBytes, total: totalBytes, lengthComputable: true }))
          })
        } else {
          // Not proxied — send original XHR and capture response body for logging
          function onLoad(this: XMLHttpRequest) {
            try {
              const t = this.responseText
              if (t && t.length <= MAX) {
                window.postMessage(
                  {
                    type: PREFIX + 'response-body',
                    payload: {
                      url: this.responseURL || u,
                      method: m,
                      pathname: path(this.responseURL || u),
                      body: t,
                      timestamp: Date.now(),
                    },
                  },
                  '*'
                )
              }
            } catch {
              // ignore
            }
          }
          if (x.addEventListener) {
            x.addEventListener('load', onLoad)
          } else {
            const old = x.onreadystatechange
            x.onreadystatechange = function (this: XMLHttpRequest) {
              if (this.readyState === 4) onLoad.call(this)
              if (old) (old as () => void).apply(this)
            }
          }
          origSend.call(x, args[0] as (Document | XMLHttpRequestBodyInit | null | undefined))
        }
      }

      window.postMessage({ type: PREFIX + 'fetch', id, url: u, method: m, headers: capturedHeaders, body: bodyToSend }, '*')
      // Do NOT call origSend here — wait for proxy check response
      // Fallback: if no response arrives within 30s, send original XHR
      setTimeout(() => {
        if (pendingFetches[id]) {
          delete pendingFetches[id]
          function onLoad(this: XMLHttpRequest) {
            try {
              const t = this.responseText
              if (t && t.length <= MAX) {
                window.postMessage({ type: PREFIX + 'response-body', payload: { url: this.responseURL || u, method: m, pathname: path(this.responseURL || u), body: t, timestamp: Date.now() } }, '*')
              }
            } catch { /* ignore */ }
          }
          if (x.addEventListener) {
            x.addEventListener('load', onLoad)
          }
          origSend.call(x, args[0] as (Document | XMLHttpRequestBodyInit | null | undefined))
        }
      }, 30000)
    }
}
