# Local Gateway Proxy

A desktop application built with Electron for managing and running API Gateway proxy servers locally. Create multiple workspaces, configure endpoints, map variables, and control proxy servers with an intuitive interface.

<img width="1552" height="926" alt="image" src="https://github.com/user-attachments/assets/a1cb92d6-22bd-417c-95b0-bfd8f54d5c03" />

## Features

- 🚀 **Multiple Workspaces**: Create and manage multiple proxy server workspaces simultaneously
- 🔧 **Gateway Configuration**: Import and edit AWS API Gateway-style configurations
- 🌐 **Endpoint Management**: Enable/disable individual endpoints and configure HTTP methods
- 📝 **Variable Mapping**: Map stage variables and path parameters dynamically
- 🎯 **Path Parameter Support**: Handle dynamic path parameters (e.g., `/users/{id}`)
- 📊 **Server Status**: Real-time server status monitoring and logs
- 💾 **Persistent Storage**: Workspaces are automatically saved to localStorage
- 🎨 **Modern UI**: Built with React, TypeScript, and Tailwind CSS

## Installation

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd local-gateway-proxy
```

2. Install dependencies:
```bash
npm install
```

3. Build the application:
```bash
npm run build
```

4. Start the application:
```bash
npm start
```

## Building for Distribution

The application can be built into installable packages for macOS, Windows, and Linux.

### Generate Icons

First, generate the application icons:

```bash
npm run build:icons
```

### Build for Specific Platforms

**macOS:**
```bash
npm run build:mac
```
Creates DMG and ZIP files for both Intel (x64) and Apple Silicon (arm64).

**Windows:**
```bash
npm run build:win
```
Creates NSIS installer and portable executable.

**Linux:**
```bash
npm run build:linux
```
Creates AppImage, DEB, and RPM packages.

**All Platforms:**
```bash
npm run build:all
```

All built files will be placed in the `release/` directory.

For more detailed build instructions, see [BUILD.md](./BUILD.md).

## Development

Run the application in development mode with hot-reload:

```bash
npm run dev
```

This will:
- Start the Vite dev server on port 5173
- Compile TypeScript files
- Launch Electron with hot-reload enabled

## Quick Start

Get up and running in 5 minutes:

1. **Start the app**: `npm start`
2. **Create a workspace**: Click "+" in the sidebar (or use the default one)
3. **Paste your config**: Go to Config tab and paste your AWS API Gateway JSON
4. **Set variables**: Go to Variables tab and fill in the values
5. **Start server**: Toggle the server switch ON
6. **Test it**: Make a request to `http://localhost:3000/your-endpoint`

That's it! Your proxy server is now running.

## How to Use

This guide will walk you through using Local Gateway Proxy from start to finish.

### Step 1: Launch the Application

After installation, start the application:

```bash
npm start
```

The application window will open, showing the sidebar on the left and the main workspace area on the right.

### Step 2: Create Your First Workspace

1. **Click the "+" button** in the sidebar (or the workspace will be created automatically on first launch)
2. A new workspace appears with a default name like "Workspace 1"
3. **Rename the workspace** by clicking on its name in the sidebar and typing a new name (e.g., "Production API" or "Development")
4. Each workspace automatically gets a unique port number (starting from 3000)

### Step 3: Configure Your Gateway

1. **Select your workspace** from the sidebar
2. You'll see the main workspace view with tabs: Config, Endpoints, Variables, and Logs
3. **Click on the "Config" tab** (usually selected by default)
4. **Paste your AWS API Gateway configuration JSON** into the editor

#### Example Configuration

Here's a sample configuration you can use:

```json
{
  "paths": {
    "/users/{id}": {
      "get": {
        "x-amazon-apigateway-integration": {
          "type": "http_proxy",
          "uri": "https://jsonplaceholder.typicode.com/users/${stageVariables.userId}/{id}"
        }
      }
    },
    "/posts": {
      "get": {
        "x-amazon-apigateway-integration": {
          "type": "http_proxy",
          "uri": "https://jsonplaceholder.typicode.com/posts"
        }
      },
      "post": {
        "x-amazon-apigateway-integration": {
          "type": "http_proxy",
          "uri": "https://jsonplaceholder.typicode.com/posts"
        }
      }
    },
    "/comments": {
      "get": {
        "x-amazon-apigateway-integration": {
          "type": "http_proxy",
          "uri": "https://jsonplaceholder.typicode.com/comments?postId=${stageVariables.postId}"
        }
      }
    }
  }
}
```

5. **The app automatically parses** the configuration when you paste it
6. You'll see endpoints appear in the "Endpoints" tab automatically

### Step 4: Configure Variables

1. **Click on the "Variables" tab**
2. You'll see all stage variables extracted from your configuration (e.g., `stageVariables.userId`, `stageVariables.postId`)
3. **Enter values** for each variable:
   - For `stageVariables.userId`: Enter a number like `1`
   - For `stageVariables.postId`: Enter a number like `1`
4. Variables are used to replace `${stageVariables.variableName}` placeholders in your URI templates

**Note**: Path parameters (like `{id}`) are automatically extracted from the request URL and don't need to be set manually.

### Step 5: Review and Manage Endpoints

1. **Click on the "Endpoints" tab**
2. You'll see a list of all parsed endpoints with:
   - HTTP method (GET, POST, etc.)
   - Path pattern
   - Target URI template
   - Enable/disable toggle
3. **Review each endpoint** to ensure they're correct
4. **Toggle endpoints on/off** as needed:
   - Enabled endpoints (toggle ON) will be proxied when the server is running
   - Disabled endpoints (toggle OFF) will return 404 even if the server is running

### Step 6: Start the Proxy Server

1. **Locate the server status toggle** at the top of the workspace view
2. **Click the toggle** to start the server
3. You'll see:
   - The toggle switch to "ON" (green/active state)
   - A success message in the logs: "Server started on port [port number]"
   - Information about how many endpoints were loaded
4. **Check the "Logs" tab** to see server activity and request logs

### Step 7: Test Your Proxy

Once the server is running, you can test it using curl, Postman, or your browser:

#### Example Requests

**GET request with path parameter:**
```bash
curl http://localhost:3000/users/1
```
This will proxy to: `https://jsonplaceholder.typicode.com/users/[userId]/1`

**GET request with query parameters:**
```bash
curl http://localhost:3000/comments
```
This will proxy to: `https://jsonplaceholder.typicode.com/comments?postId=[postId]`

**POST request:**
```bash
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "body": "Content"}'
```

#### Understanding the Proxy Flow

1. Request comes to: `http://localhost:3000/users/123`
2. App matches the endpoint: `/users/{id}` with GET method
3. Extracts path parameter: `id = 123`
4. Resolves variables: Replaces `${stageVariables.userId}` with the value you set
5. Proxies to: `https://jsonplaceholder.typicode.com/users/[userId]/123`
6. Returns the response to your client

### Step 8: Monitor Server Activity

1. **Click on the "Logs" tab** to see:
   - Server start/stop events
   - Request logs showing which endpoints were hit
   - Error messages if something goes wrong
2. Logs show timestamps and message types (info, success, error)

### Step 9: Stop the Server

1. **Click the server status toggle** again to stop the server
2. The toggle switches to "OFF"
3. A log entry confirms: "Server stopped"
4. All requests to the proxy port will fail until you start it again

### Step 10: Create Multiple Workspaces (Optional)

1. **Click the "+" button** in the sidebar again
2. Create a second workspace (e.g., "Staging API")
3. Configure it with different settings:
   - Different port (e.g., 3001)
   - Different configuration
   - Different variable values
4. **Switch between workspaces** by clicking on them in the sidebar
5. **Run multiple servers simultaneously** - each workspace can have its own server running independently

### Advanced Usage

#### Changing the Port

1. Select a workspace
2. Find the port field in the workspace settings
3. Change the port number (e.g., from 3000 to 8080)
4. Restart the server for the change to take effect

#### Editing Configuration After Server Start

1. Make changes to your configuration JSON
2. The endpoints will be re-parsed automatically
3. **Restart the server** to apply the changes:
   - Stop the server
   - Start it again
   - New endpoints will be registered

#### Disabling Endpoints Temporarily

1. Go to the "Endpoints" tab
2. Toggle OFF any endpoint you want to disable
3. **Restart the server** for changes to take effect
4. Disabled endpoints will return 404 when accessed

### Gateway Configuration Format Reference

The app expects an AWS API Gateway-style configuration with this structure:

```json
{
  "paths": {
    "/your-path/{param}": {
      "http-method": {
        "x-amazon-apigateway-integration": {
          "type": "http_proxy",
          "uri": "https://target-url.com/path/${stageVariables.varName}/{param}"
        }
      }
    }
  }
}
```

**Key Points:**
- `paths`: Object containing all your API paths
- Path parameters: Use `{paramName}` in the path (e.g., `/users/{id}`)
- HTTP methods: Use lowercase (get, post, put, delete, patch, etc.)
- `uri`: The target URL where requests will be proxied
- Stage variables: Use `${stageVariables.variableName}` format
- Path parameters: Use `{paramName}` format (will be replaced from the request URL)

### Complete Workflow Example

Here's a complete example workflow:

**Scenario**: You want to proxy requests to a JSONPlaceholder API with custom variables.

1. **Start the app** and create a workspace named "JSONPlaceholder Proxy"

2. **Paste this configuration** in the Config tab:
```json
{
  "paths": {
    "/users/{userId}": {
      "get": {
        "x-amazon-apigateway-integration": {
          "type": "http_proxy",
          "uri": "https://jsonplaceholder.typicode.com/users/${stageVariables.apiVersion}/{userId}"
        }
      }
    }
  }
}
```

3. **Go to Variables tab** and set:
   - `stageVariables.apiVersion`: `v1`

4. **Go to Endpoints tab** and verify the endpoint `/users/{userId}` is enabled

5. **Start the server** by toggling the switch ON

6. **Test with curl**:
```bash
curl http://localhost:3000/users/1
```

7. **What happens**:
   - Request: `GET http://localhost:3000/users/1`
   - App extracts: `userId = 1` from the path
   - App replaces: `${stageVariables.apiVersion}` with `v1`
   - Proxies to: `https://jsonplaceholder.typicode.com/users/v1/1`
   - Returns the response

8. **Check logs** to see the request was processed successfully

### Tips for Best Results

- **Use descriptive workspace names** to organize different environments
- **Set default variable values** that work for most cases
- **Enable only needed endpoints** to reduce complexity
- **Check logs regularly** to monitor proxy behavior
- **Test endpoints** before relying on them in production workflows
- **Keep configurations versioned** - copy/paste works well for backup

## Project Structure

```
proxy-app/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts      # Main window and IPC handlers
│   │   └── server.ts     # Express proxy server manager
│   ├── preload/           # Preload scripts
│   │   └── index.ts      # Context bridge setup
│   └── renderer/          # React frontend
│       └── src/
│           ├── App.tsx    # Main app component
│           ├── components/ # UI components
│           ├── utils/     # Utilities and parsers
│           └── types.ts   # TypeScript definitions
├── dist/                  # Build output
├── package.json
└── vite.config.ts        # Vite configuration
```

## Technology Stack

- **Electron** - Desktop application framework
- **React** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Express** - HTTP server framework
- **http-proxy** - HTTP proxy middleware
- **Radix UI** - Accessible UI components

## How It Works

1. **Configuration Parsing**: The app parses AWS API Gateway JSON configurations to extract endpoints and variables
2. **Server Management**: Each workspace runs an independent Express server on a configurable port
3. **Request Proxying**: Incoming requests are matched against configured endpoints and proxied to target URLs
4. **Variable Resolution**: Stage variables and path parameters are resolved before proxying requests
5. **Endpoint Filtering**: Only enabled endpoints are registered in the Express router

## Example Use Cases

- **Local API Development**: Proxy requests to remote APIs while developing locally
- **API Testing**: Test different API configurations without deploying
- **Environment Simulation**: Simulate different API Gateway stages locally
- **Request Debugging**: Monitor and log all proxied requests

## Troubleshooting

### Port Already in Use

If you get a "port already in use" error:
- Change the port number in the workspace settings
- Stop any other services using that port

### Endpoints Not Working

- Ensure the server is running (check the status switch)
- Verify the endpoint is enabled
- Check the server logs for errors
- Validate your gateway configuration JSON

### Variables Not Resolving

- Ensure variables are set in the Variables tab
- Check that variable names match exactly (case-sensitive)
- Verify the variable format: `${stageVariables.variableName}`

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

