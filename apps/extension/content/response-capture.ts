/**
 * Isolated-world content script that bridges the MAIN-world fetch/XHR patch and the background.
 * The patch itself is installed by content/fetch-patch-main.ts; if it's missing, we ask the
 * background to inject it with chrome.scripting.executeScript (world: MAIN).
 * Page context cannot use chrome.* - we use postMessage for communication.
 */
const PREFIX = '__proxy_app_'

let warnedInvalidated = false

function safeSendMessage(message: unknown): Promise<unknown> {
  try {
    return chrome.runtime.sendMessage(message).catch(warnInvalidated)
  } catch (err) {
    warnInvalidated(err)
    return Promise.resolve()
  }
}

/** Orphaned after an extension reload: nothing reaches the background until the page is reloaded */
function warnInvalidated(err: unknown): void {
  if (warnedInvalidated) return
  warnedInvalidated = true
  console.warn('[proxy-app] cannot reach extension background — reload this page to capture response bodies.', err)
}

function main(): void {
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window || !e.data?.type) return
    if (e.data.type === PREFIX + 'fetch') {
      const { id, url, method, headers, body } = e.data
      // Convert ArrayBuffer to number[] for reliable serialization via chrome.runtime.sendMessage
      const bodyToSend = body instanceof ArrayBuffer ? Array.from(new Uint8Array(body)) : (body ?? null)
      safeSendMessage({ type: 'proxy-fetch', payload: { url, method, headers, body: bodyToSend } })
        .then((result) => {
          window.postMessage({ type: PREFIX + 'fetch-result', id, result }, '*')
        })
        .catch(() => {
          window.postMessage({ type: PREFIX + 'fetch-result', id, result: { proxied: false } }, '*')
        })
      return
    }
    if (e.data.type === PREFIX + 'response-body') {
      safeSendMessage({ type: 'response-body', payload: e.data.payload })
      return
    }
    if (e.data.type === PREFIX + 'response-body-skip') {
      safeSendMessage({ type: 'response-body-skip', payload: e.data.payload })
    }
  })

  // Prerendered documents have no tab id yet; report once the page is shown in a tab
  if ((document as Document & { prerendering?: boolean }).prerendering) {
    document.addEventListener('prerenderingchange', reportPatchStatus, { once: true })
  } else {
    reportPatchStatus()
  }
}

function reportPatchStatus(): void {
  const patched = document.documentElement?.getAttribute('data-proxy-app-patched') === '1'
  safeSendMessage({ type: 'inject-fetch-patch', payload: { prefix: PREFIX, alreadyPatched: patched } })
}

// Run immediately on load; wrapper calls default export as "mount" - export no-op so it doesn't undo our patches
main()
export default () => {}
