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

    XHR.prototype.open = function (method: string, url: string) {
      ;(this as unknown as { __cu: string; __cm: string }).__cu = url
      ;(this as unknown as { __cu: string; __cm: string }).__cm = (method || 'GET').toUpperCase()
      return origOpen.apply(this, arguments as unknown as [string, string])
    }

    XHR.prototype.send = function (...args: unknown[]) {
      const x = this
      const u = (x as unknown as { __cu: string }).__cu
      const m = (x as unknown as { __cm: string }).__cm || 'GET'
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
      return origSend.apply(this, args)
    }
}
