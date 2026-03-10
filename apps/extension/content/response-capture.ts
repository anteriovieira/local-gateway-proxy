/**
 * Content script that injects a main-world script to patch the page's fetch/XHR.
 * Content scripts run in an isolated world - the page's fetch is separate.
 * We use chrome.scripting.executeScript (world: MAIN) to inject - bypasses CSP.
 * Page context cannot use chrome.* - we use postMessage for communication.
 */
const PREFIX = '__proxy_app_'

function main(): void {
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window || !e.data?.type) return
    if (e.data.type === PREFIX + 'fetch') {
      const { id, url, method, headers, body } = e.data
      chrome.runtime
        .sendMessage({ type: 'proxy-fetch', payload: { url, method, headers, body } })
        .then((result) => {
          window.postMessage({ type: PREFIX + 'fetch-result', id, result }, '*')
        })
        .catch(() => {
          window.postMessage({ type: PREFIX + 'fetch-result', id, result: { proxied: false } }, '*')
        })
      return
    }
    if (e.data.type === PREFIX + 'response-body') {
      chrome.runtime.sendMessage({ type: 'response-body', payload: e.data.payload }).catch(() => {})
    }
  })

  // Request background to inject into main world (bypasses CSP that blocks inline scripts)
  chrome.runtime.sendMessage({ type: 'inject-fetch-patch', payload: { prefix: PREFIX } }).catch(() => {})
}

// Run immediately on load; wrapper calls default export as "mount" - export no-op so it doesn't undo our patches
const _ = main()
export default () => {}
