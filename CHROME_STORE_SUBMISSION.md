# Chrome Web Store — Submission Document

All copy and answers required to publish the extension on the Chrome Web Store.

---

## 1. Basic Information

### Extension Name
```
Proxy App
```
_(45 character limit — "Proxy App" uses 9)_

### Short Description
_(132 character limit)_
```
Intercept and proxy API requests directly in your browser. Configure endpoints, mock responses, and bypass CORS — no server needed.
```

### Category
```
Developer Tools
```

### Language
```
English
```

---

## 2. Detailed Description
_(16,000 character limit. Use plain text; basic formatting with newlines is supported.)_

```
Proxy App is a developer tool that lets you intercept, proxy, and mock HTTP requests made by any web page — all from a convenient side panel, without installing a local server.

WHAT IT DOES

When you activate a workspace, Proxy App patches the fetch API of the active page. Every outgoing request is matched against your configured endpoint rules. Matched requests are forwarded to the target URL (resolving stage variables and path parameters), and the response is returned to the page transparently. Unmatched requests pass through unaffected.

KEY FEATURES

Proxy endpoints — Define endpoint rules with AWS API Gateway-style JSON. Requests are matched by HTTP method and path pattern, then forwarded to the configured backend URL. Stage variables (${stageVariables.name}) and path parameters ({id}) are resolved automatically.

CORS bypass — Proxied requests are made from the extension background context, so cross-origin restrictions that would normally block the page do not apply.

Mock responses — Mark any endpoint as a mock to return a fixed JSON response without hitting a real server. Configure the HTTP status code, response body, response headers, and an optional simulated delay.

Mock database — Enable a lightweight in-memory CRUD database for a workspace. The extension automatically handles GET (list/get), POST (create), PUT/PATCH (update), and DELETE operations on your defined collections, persisting state across service worker restarts within the browser session.

Request log — Every proxied and mocked request is recorded with URL, HTTP method, status code, duration, request headers, request body, response headers, and response body. Inspect individual requests in detail directly from the side panel.

Multiple workspaces — Organize your proxy rules into separate workspaces. Switch between them with one click.

Persistent configuration — Workspace settings and the active proxy state are saved to extension storage and restored automatically when you reopen the browser or the side panel.

No local server required — Unlike desktop proxy tools, Proxy App runs entirely inside Chrome. There is nothing to install outside the browser.

HOW TO USE

1. Click the Proxy App icon in the toolbar to open the side panel.
2. Create a workspace or use the default one.
3. Paste your API Gateway-style JSON configuration into the Config tab.
4. Set stage variable values in the Variables tab.
5. Enable or disable individual endpoints in the Endpoints tab.
6. Toggle the proxy ON using the switch at the top of the workspace.
7. Use the page as normal — matching requests will be proxied automatically.
8. Inspect requests in the Logs tab.

CONFIGURATION FORMAT

The extension accepts standard AWS API Gateway export JSON:

{
  "paths": {
    "/users/{id}": {
      "get": {
        "x-amazon-apigateway-integration": {
          "type": "http_proxy",
          "uri": "https://api.example.com/users/${stageVariables.env}/{id}"
        }
      }
    }
  }
}

USE CASES

- Redirect production API calls to a local or staging backend during development.
- Test frontend changes against a different API version without redeploying.
- Simulate API responses with mock endpoints when the backend is not yet ready.
- Debug requests in detail using the built-in request log.
- Reproduce environment-specific bugs by mapping stage variables to different values.

PERMISSIONS

The extension requests only the permissions it needs to intercept and forward requests. See the Privacy section for a detailed explanation of each permission.

---

Proxy App is open source. Issues and contributions are welcome.
```

---

## 3. Privacy Practices

### Single Purpose Description
_(Describe the single purpose of the extension in one sentence.)_
```
Proxy App intercepts outgoing HTTP requests from the active web page and forwards them to developer-configured backend URLs, enabling local API proxying and response mocking without a server.
```

### Does the extension use remote code?
```
No
```

### Data usage disclosures

**Does the extension handle any of the following user data?**

| Data type | Collected? | Notes |
|---|---|---|
| Personally identifiable information | No | — |
| Health information | No | — |
| Financial and payment information | No | — |
| Authentication information | No | — |
| Personal communications | No | — |
| Location | No | — |
| Web history | No | — |
| User activity | No | — |
| Website content | No | HTTP request/response bodies are read only to log them in the extension's side panel. They are never transmitted outside the browser. |

**Is any data transmitted outside the browser?**
```
No. Request bodies and response bodies captured by the logger are stored in extension memory only and displayed in the side panel. No data is sent to any external server or analytics service.
```

---

## 4. Permission Justifications

Each permission declared in `manifest.json` must be justified during submission.

### `sidePanel`
```
Required to render the extension's main UI in Chrome's side panel. All workspace management, configuration editing, endpoint management, and request log inspection happen inside the side panel.
```

### `storage`
```
Required to persist workspace configurations, endpoint rules, stage variables, and the active proxy state across browser sessions. Without storage, all settings would be lost when the browser is closed.
```

### `webRequest`
```
Required to observe network request activity for logging purposes and to support matching requests against configured endpoint rules.
```

### `scripting`
```
Required to inject the fetch-patching script into the main world of the active page. Content scripts run in an isolated world and cannot access the page's own fetch function; chrome.scripting.executeScript with world: "MAIN" is the only supported way to intercept and override fetch on the page itself.
```

### `declarativeNetRequestWithHostAccess`
```
Required to add and remove dynamic redirect rules when the extension is used in desktop-proxy mode (redirecting matching requests to a local proxy server). Rules are created only while the proxy is active and are removed immediately when the proxy is deactivated.
```

### `declarativeNetRequestFeedback`
```
Required to read the result of declarativeNetRequest rules for diagnostic and logging purposes, so the extension can report whether redirect rules are being applied correctly.
```

### `activeTab`
```
Required to identify the currently active tab so that the fetch-patching script can be injected into the correct page when the user activates the proxy.
```

### `tabs`
```
Required to query tab information (tab ID, URL) needed to inject scripts into the correct tab and to associate proxied request logs with the originating tab.
```

### `host_permissions: <all_urls>`
```
The extension must be able to intercept and proxy requests to any URL, because developers target arbitrary backend APIs that are not known in advance. Restricting host permissions to a fixed list of origins would make the extension non-functional for the majority of use cases. The permission is used solely to proxy requests as configured by the developer; no data from visited pages is collected or transmitted.
```

---

## 5. Store Listing Assets

### Icon sizes required
- 128x128 px (store listing)
- 16x16, 48x48 (toolbar / extension management page — already included in `manifest.json`)

Files are located at:
```
apps/extension/public/icons/icon-16.png
apps/extension/public/icons/icon-48.png
apps/extension/public/icons/icon-128.png
```

### Screenshots
_(At least 1 required; 1280x800 or 640x400 px, PNG or JPEG)_

Suggested screenshots to capture:

1. **Side panel — Workspaces overview**: Show the sidebar with a workspace selected and the Endpoints tab visible with several endpoints listed.
2. **Config tab**: Show the JSON configuration editor with a sample API Gateway config pasted in.
3. **Variables tab**: Show stage variables with values filled in.
4. **Logs tab — Request detail**: Show a completed proxied request expanded with status code, duration, request headers, and response body visible.
5. **Mock endpoint**: Show an endpoint configured as a mock with a custom response body and status code.

### Promotional tile (optional, 440x280 px)
Suggested tagline for the tile graphic:
```
Proxy App — Intercept. Mock. Debug.
```

---

## 6. Distribution

### Visibility
```
Public
```

### Regions
```
All regions
```

### Pricing
```
Free
```

---

## 7. Developer Contact

_(Fill in before submitting)_

| Field | Value |
|---|---|
| Developer name | _(your name or org)_ |
| Developer email | _(your support email)_ |
| Website / support URL | _(your repo or landing page URL)_ |
| Privacy policy URL | _(required — host a privacy policy page)_ |

### Minimal privacy policy text
_(Host this at a public URL and provide it during submission.)_

```
Privacy Policy — Proxy App Chrome Extension

Last updated: March 2026

Proxy App does not collect, store, transmit, or share any personal data or browsing data.

All configuration data (workspace settings, endpoint rules, stage variables) is stored locally in your browser using the Chrome extension storage API and is never sent to any external server.

HTTP request and response data captured by the built-in request logger is held in memory only for the duration of your browser session and is displayed exclusively within the extension's side panel. This data is never transmitted outside your browser.

The extension makes outgoing HTTP requests only as explicitly configured by you (the developer) in your proxy rules.

For questions, contact: [your email]
```
