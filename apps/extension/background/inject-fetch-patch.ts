/**
 * Patches fetch/XHR in the page's MAIN world, and in every same-origin Web Worker the page creates.
 * Runs from the MAIN-world content script (content/fetch-patch-main.ts) at document_start, and as a
 * fallback via chrome.scripting.executeScript.
 *
 * Must stay self-contained (no closure, no imports): it is serialized for executeScript and its own
 * source is used to bootstrap workers. In a worker, WORKER_CHANNEL names a BroadcastChannel the page
 * relays to the content script (workers can't reach content scripts), and WORKER_BASE is the
 * worker's real script URL (the worker runs from a blob: URL, so relative URLs need it).
 */
export function injectFetchPatch(PREFIX: string, MAX: number, WORKER_CHANNEL?: string, WORKER_BASE?: string): void {
    const g = self as unknown as Record<string, unknown> & typeof globalThis
    const isWindow = typeof window !== 'undefined' && (g as unknown) === window

    // Prevent double-patching when extension reloads while page is open
    const guardKey = '__proxyApp_injected_' + PREFIX
    if (g[guardKey]) return
    g[guardKey] = true
    if (isWindow) {
      // DOM is shared with the isolated content script, so it can tell whether the patch is in place
      try {
        document.documentElement.setAttribute('data-proxy-app-patched', '1')
      } catch {
        // documentElement not available yet
      }
    }

    // Page: window.postMessage to the content script. Worker: BroadcastChannel relayed by the page.
    const channel = !isWindow && WORKER_CHANNEL && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(WORKER_CHANNEL) : null
    function send(msg: Record<string, unknown>): void {
      if (isWindow) window.postMessage(msg, '*')
      else channel?.postMessage(msg)
    }
    function onBridgeMessage(handler: (data: { type?: string; id?: unknown; result?: unknown }) => void): void {
      if (isWindow) {
        window.addEventListener('message', (e: MessageEvent) => {
          if (e.source === window && e.data?.type) handler(e.data)
        })
      } else if (channel) {
        channel.addEventListener('message', (e: MessageEvent) => {
          if (e.data?.type) handler(e.data)
        })
      }
    }

    function absolute(u: string): string {
      try {
        return new URL(u, WORKER_BASE || location.href).href
      } catch {
        return u
      }
    }

    function path(u: string): string {
      try {
        return new URL(u).pathname
      } catch {
        return ''
      }
    }
    function reportBody(url: string, method: string, text: string | null, skipReason?: string): void {
      let reason = skipReason
      if (!reason && !text) reason = 'empty response body'
      if (!reason && text && text.length > MAX) reason = `body too large (${text.length} chars > ${MAX})`
      if (reason) {
        send({ type: PREFIX + 'response-body-skip', payload: { url, method, reason } })
        return
      }
      send({ type: PREFIX + 'response-body', payload: { url, method, pathname: path(url), body: text, timestamp: Date.now() } })
    }

    function xhrBody(x: XMLHttpRequest): { text: string | null; skip?: string } {
      try {
        if (x.responseType === '' || x.responseType === 'text') return { text: x.responseText }
        if (x.responseType === 'json') return { text: x.response == null ? null : JSON.stringify(x.response) }
        return { text: null, skip: `XHR responseType "${x.responseType}" is not text` }
      } catch (err) {
        return { text: null, skip: `failed to read XHR body: ${String(err)}` }
      }
    }

    // Ids are unique per context so page and worker requests never collide in the shared relay
    const ctxId = Math.random().toString(36).slice(2, 10)
    const pendingFetches: Record<string, (r: unknown) => void> = {}
    let nextSeq = 1
    const nextId = () => `${ctxId}:${nextSeq++}`

    onBridgeMessage((data) => {
      if (data.type !== PREFIX + 'fetch-result') return
      const id = String(data.id)
      if (pendingFetches[id]) {
        pendingFetches[id](data.result)
        delete pendingFetches[id]
      }
    })

    if (isWindow && typeof Worker !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      patchWorkers()
    }

    /**
     * Boot each same-origin worker with this patch before its own script, so requests made from
     * workers (e.g. Comlink workers) are proxied and logged too.
     */
    function patchWorkers(): void {
      const OrigWorker = Worker
      const selfSource = injectFetchPatch.toString()
      const Wrapped = function (scriptURL: string | URL, options?: WorkerOptions): Worker {
        let abs: URL
        try {
          abs = new URL(String(scriptURL), location.href)
        } catch {
          return new OrigWorker(scriptURL, options)
        }
        if (abs.origin !== location.origin) return new OrigWorker(scriptURL, options)
        try {
          const channelName = PREFIX + 'worker:' + Math.random().toString(36).slice(2)
          const ch = new BroadcastChannel(channelName)
          // worker -> content script
          ch.addEventListener('message', (e: MessageEvent) => {
            if (typeof e.data?.type === 'string' && e.data.type.indexOf(PREFIX) === 0) window.postMessage(e.data, '*')
          })
          // content script -> worker (workers ignore ids they don't own)
          window.addEventListener('message', (e: MessageEvent) => {
            if (e.source === window && e.data?.type === PREFIX + 'fetch-result') ch.postMessage(e.data)
          })
          const boot = `(${selfSource})(${JSON.stringify(PREFIX)}, ${MAX}, ${JSON.stringify(channelName)}, ${JSON.stringify(abs.href)});`
          const bootUrl = URL.createObjectURL(new Blob([boot], { type: 'text/javascript' }))
          // Module imports evaluate in order, so the patch runs before the worker's own code
          const entry =
            options?.type === 'module'
              ? `import ${JSON.stringify(bootUrl)};\nimport ${JSON.stringify(abs.href)};`
              : `importScripts(${JSON.stringify(bootUrl)}, ${JSON.stringify(abs.href)});`
          return new OrigWorker(URL.createObjectURL(new Blob([entry], { type: 'text/javascript' })), options)
        } catch {
          return new OrigWorker(scriptURL, options)
        }
      } as unknown as typeof Worker
      Wrapped.prototype = OrigWorker.prototype
      ;(window as unknown as { Worker: typeof Worker }).Worker = Wrapped
    }

    const origFetch = g.fetch
    g.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const rawUrl = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
      const url = absolute(rawUrl)
      const method = ((init?.method ?? (input instanceof Request ? input.method : 'GET')) || 'GET').toUpperCase()

      try {
        const req = input instanceof Request ? input : new Request(url, init)
        const headers: Record<string, string> = {}
        req.headers.forEach((v, k) => {
          headers[k] = v
        })
        const body = req.body ? await req.clone().arrayBuffer() : null
        const id = nextId()
        const r = await new Promise<unknown>((resolve) => {
          pendingFetches[id] = resolve
          send({ type: PREFIX + 'fetch', id, url, method, headers, body })
          setTimeout(() => {
            if (pendingFetches[id]) {
              delete pendingFetches[id]
              resolve({ proxied: false })
            }
          }, 30000)
        })
        const res = r as { proxied?: boolean; status?: number; statusText?: string; headers?: Record<string, string>; body?: number[] }
        if (res?.proxied && res.status !== undefined) {
          const bodyBuf = Array.isArray(res.body) ? new Uint8Array(res.body).buffer : (res.body ?? null)
          return new Response(bodyBuf, {
            status: res.status,
            statusText: res.statusText ?? '',
            headers: res.headers ?? {},
          })
        }
      } catch {
        // fall through
      }

      const response = await origFetch.call(this, typeof input === 'string' && url !== input ? url : input, init)
      const respUrl = response.url || url
      response
        .clone()
        .text()
        .then((text) => reportBody(respUrl, method, text))
        .catch((err) => reportBody(respUrl, method, null, `failed to read fetch body: ${String(err)}`))
      return response
    }

    const XHR = g.XMLHttpRequest
    const origOpen = XHR.prototype.open
    const origSend = XHR.prototype.send
    const origSetRequestHeader = XHR.prototype.setRequestHeader

    XHR.prototype.open = function (method: string, url: string) {
      ;(this as unknown as { __cu: string; __cm: string; __xhrHeaders: Record<string, string> }).__cu = absolute(String(url))
      ;(this as unknown as { __cu: string; __cm: string; __xhrHeaders: Record<string, string> }).__cm = (method || 'GET').toUpperCase()
      ;(this as unknown as { __cu: string; __cm: string; __xhrHeaders: Record<string, string> }).__xhrHeaders = {}
      // In a blob-hosted worker, relative URLs must resolve against the worker's real script URL
      const args = Array.prototype.slice.call(arguments) as [string, string, boolean]
      if (WORKER_BASE) args[1] = absolute(String(url))
      return origOpen.apply(this, args)
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

      const id = nextId()

      pendingFetches[id] = (r: unknown) => {
        const res = r as { proxied?: boolean; status?: number; statusText?: string; headers?: Record<string, string>; body?: number[] }
        if (res?.proxied && res.status !== undefined) {
          // Inject proxied response into XHR without sending to the original URL
          let responseText = ''
          try {
            if (res.body) {
              const buf = Array.isArray(res.body) ? new Uint8Array(res.body) : res.body
              responseText = new TextDecoder().decode(buf)
            }
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
            const { text, skip } = xhrBody(this)
            reportBody(this.responseURL || u, m, text, skip)
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

      send({ type: PREFIX + 'fetch', id, url: u, method: m, headers: capturedHeaders, body: bodyToSend })
      // Do NOT call origSend here — wait for proxy check response
      // Fallback: if no response arrives within 30s, send original XHR
      setTimeout(() => {
        if (pendingFetches[id]) {
          delete pendingFetches[id]
          function onLoad(this: XMLHttpRequest) {
            const { text, skip } = xhrBody(this)
            reportBody(this.responseURL || u, m, text, skip)
          }
          if (x.addEventListener) {
            x.addEventListener('load', onLoad)
          }
          origSend.call(x, args[0] as (Document | XMLHttpRequestBodyInit | null | undefined))
        }
      }, 30000)
    }
}
