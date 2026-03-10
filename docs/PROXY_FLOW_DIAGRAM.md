# Proxy Flow Diagram

Visual representation of the request flow in proxy mode for both Extension and Desktop.

---

## Extension Mode (Chrome)

The extension uses `declarativeNetRequest` to redirect matching requests from the page to the backend. The response flows back to the caller.

```mermaid
sequenceDiagram
    participant Page as Page (Origin)
    participant dNR as declarativeNetRequest
    participant Browser as Browser Network
    participant Backend as Backend API
    participant Logger as request-logger
    participant UI as Extension Panel

    Page->>Browser: fetch('/api/search/topics')
    Browser->>dNR: Intercept request
    dNR->>dNR: Match endpoint, resolve targetUrl
    dNR->>Browser: Redirect to backend URL
    Browser->>Backend: GET https://api.example.com/api/search/topics
    Logger->>Logger: onBeforeRequest (log origin, destination)
    Logger->>UI: broadcastLog (pending)
    Backend-->>Browser: Response (200/400/etc)
    Logger->>Logger: onCompleted / onErrorOccurred
    Logger->>UI: broadcastLog (update with status)
    Browser-->>Page: Response (caller receives target response)
```

```mermaid
flowchart LR
    subgraph Origin["Origin (Caller)"]
        Page[Page / App]
    end

    subgraph Extension["Chrome Extension"]
        dNR[declarativeNetRequest]
        Logger[request-logger]
        Panel[Extension Panel]
    end

    subgraph Target["Destination"]
        Backend[Backend API]
    end

    Page -->|"1. Request"| dNR
    dNR -->|"2. Redirect"| Backend
    Backend -->|"3. Response"| Page
    dNR -.->|"4. Log"| Logger
    Logger -.->|"5. Display"| Panel
```

---

## Desktop Mode (Electron)

The desktop runs a local Express server. Clients send requests to localhost; the proxy forwards to the backend and returns the response.

```mermaid
sequenceDiagram
    participant Client as Client (Postman/curl/App)
    participant Express as Express Server
    participant Proxy as http-proxy
    participant Backend as Backend API
    participant UI as Desktop UI

    Client->>Express: GET localhost:3000/api/search/topics
    Express->>Express: Match endpoint, resolve targetUrl
    Express->>UI: sendApiLog (pending)
    Express->>Proxy: proxy.web(req, res, target)
    Proxy->>Backend: GET https://api.example.com/api/search/topics
    Backend-->>Proxy: Response
    Proxy-->>Express: Response chunks
    Express->>Express: Capture response body
    Express->>UI: sendApiLog (completed)
    Express-->>Client: Response
```

```mermaid
flowchart LR
    subgraph Origin["Origin (Caller)"]
        Client[Client App]
    end

    subgraph Desktop["Electron Desktop"]
        Express[Express Server]
        Proxy[http-proxy]
        UI[Desktop UI]
    end

    subgraph Target["Destination"]
        Backend[Backend API]
    end

    Client -->|"1. Request"| Express
    Express -->|"2. Proxy"| Proxy
    Proxy -->|"3. Forward"| Backend
    Backend -->|"4. Response"| Proxy
    Proxy -->|"5. Response"| Client
    Express -.->|"6. Log"| UI
```

---

## Summary

| Mode     | Origin              | Destination | Response flow                    |
|----------|---------------------|-------------|-----------------------------------|
| Extension| Page (initiator)     | Backend API | Target response → Page           |
| Desktop  | Client (localhost)   | Backend API | Target response → Client          |

In both modes, **the caller receives the response from the target**—the proxy transparently forwards the request and returns the backend's response.
