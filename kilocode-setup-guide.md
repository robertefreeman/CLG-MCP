# KiloCode MCP Server Setup Guide

This guide covers setting up the CLG-MCP server with the KiloCode VS Code extension. For general project information, see [`README.md`](README.md). For deployment instructions, see [`DEPLOYMENT.md`](DEPLOYMENT.md).

## 🎯 Server Information
- **Server Name:** clg-mcp
- **Server URL:** https://clg-mcp.YOUR_SUBDOMAIN.workers.dev (replace with your actual URL)
- **Transport Type:** HTTP
- **Authentication:** Optional (see [`AUTHENTICATION.md`](AUTHENTICATION.md))

## 📋 Step-by-Step Setup

### 1. Open KiloCode Extension Settings
- Go to VSCode Extensions panel (Ctrl+Shift+X)
- Find the KiloCode extension
- Click the gear icon ⚙️ next to KiloCode
- Select "Extension Settings"

### 2. Add MCP Server Configuration
Look for "Add MCP Server" or "Configure Servers" option and add:

**Server Configuration:**
```
Name: clg-mcp
URL: https://clg-mcp.robrary.workers.dev
Transport: HTTP
Type: Remote/HTTP Server
Timeout: 30000 (30 seconds)
```

### 3. Alternative: Manual JSON Configuration
If KiloCode uses JSON configuration, add this to the MCP servers section:

```json
{
  "name": "clg-mcp",
  "url": "https://clg-mcp.robrary.workers.dev",
  "transport": "http",
  "description": "Cyndi's List Genealogy Research",
  "timeout": 30000,
  "enabled": true
}
```

### 4. Reload VSCode
- Press Ctrl+Shift+P (or Cmd+Shift+P)
- Type "Developer: Reload Window"
- Select it to reload VSCode

## 🔧 Available Tools After Setup

Once connected, you'll have access to these genealogy research tools:

1. **search_genealogy_resources** - Search for genealogy resources by names, locations, or keywords
2. **browse_categories** - Browse genealogy resource categories on Cyndi's List  
3. **get_resource_details** - Get detailed information about specific genealogy resources
4. **filter_resources** - Filter genealogy resources by multiple criteria
5. **get_location_resources** - Get genealogy resources for specific geographic locations

## ✅ Testing the Connection

After setup, test the connection by asking KiloCode to:
- "Search for genealogy resources about Irish immigration"
- "Browse genealogy categories"
- "Find resources for County Cork, Ireland"

## 🐛 Troubleshooting

If the server doesn't appear:
1. Verify the URL is exactly: `https://clg-mcp.robrary.workers.dev`
2. Check that "HTTP" transport type is selected (not SSE/WebSocket)
3. Ensure timeout is set to at least 30 seconds
4. Try reloading VSCode window
5. Check KiloCode extension logs for connection errors

## 📞 Server Health Check
You can verify the server is working by visiting:
https://clg-mcp.robrary.workers.dev/health

Should return:
```json
{
  "status": "healthy",
  "service": "clg-mcp", 
  "version": "1.0.0"
}