# Privacy Policy — Proxy App Chrome Extension

**Last updated: April 2026**

Proxy App does not collect, store, transmit, or share any personal data or browsing data.

All configuration data (workspace settings, endpoint rules, stage variables) is stored locally in your browser using the Chrome extension storage API and is never sent to any external server.

HTTP request and response data captured by the built-in request logger is held in memory only for the duration of your browser session and is displayed exclusively within the extension's side panel. This data is never transmitted outside your browser.

The extension makes outgoing HTTP requests only as explicitly configured by you (the developer) in your proxy rules.

## Permissions

The extension requests the following permissions solely to provide its core functionality:

- **sidePanel** — Renders the extension UI in Chrome's side panel.
- **storage** — Persists workspace settings across browser sessions.
- **webRequest** — Observes network requests for logging and matching.
- **scripting** — Injects the fetch-patching script into the active page.
- **declarativeNetRequestWithHostAccess** — Manages redirect rules for desktop-proxy mode.
- **declarativeNetRequestFeedback** — Reads rule results for diagnostics.
- **activeTab / tabs** — Identifies the active tab for script injection and log association.
- **Host permissions (`<all_urls>`)** — Required because developers target arbitrary backend APIs not known in advance.

## Contact

For questions about this privacy policy, please open an issue at [https://github.com/anteriovieira/local-gateway-proxy](https://github.com/anteriovieira/local-gateway-proxy).
