/**
 * MAIN-world content script: patches the page's fetch/XHR synchronously at document_start,
 * before any page script runs. Injecting from the background instead races page scripts and
 * fails for prerendered documents (no tab id yet).
 */
import { injectFetchPatch } from '../background/inject-fetch-patch'
import { MAX_RESPONSE_BODY_SIZE, PROXY_APP_PREFIX } from '../shared/constants'

injectFetchPatch(PROXY_APP_PREFIX, MAX_RESPONSE_BODY_SIZE)

// Wrapper calls default export as "mount" - export no-op so it doesn't undo our patches
export default () => {}
