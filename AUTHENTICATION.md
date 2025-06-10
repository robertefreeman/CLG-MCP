# MCP Server Authentication

This document describes the authentication mechanism implemented for the CLG-MCP server.

## Overview

The MCP server now supports simple Bearer token authentication to secure access to the genealogy resources. Authentication is **optional** and **backward compatible** - if no authentication tokens are configured, the server operates in public access mode.

## Authentication Methods

### 1. Single API Key

Configure a single authentication token using the `MCP_AUTH_TOKEN` environment variable.

```bash
# Set via Wrangler CLI
wrangler secret put MCP_AUTH_TOKEN

# Or set in environment
export MCP_AUTH_TOKEN="your_secret_token_here"
```

### 2. Multiple API Keys

Configure multiple authentication tokens using the `MCP_AUTH_TOKENS` environment variable (comma-separated).

```bash
# Set via Wrangler CLI
wrangler secret put MCP_AUTH_TOKENS

# Or set in environment
export MCP_AUTH_TOKENS="token1,token2,token3"
```

## Token Format

- Tokens can be any string value
- Recommended format: `mcp_sk_[environment]_[random_string]`
- Example: `mcp_sk_prod_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p`

## Usage

### Client Authentication

Include the Bearer token in the Authorization header:

```http
POST / HTTP/1.1
Host: your-mcp-server.workers.dev
Content-Type: application/json
Authorization: Bearer your_secret_token_here

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

### CORS Support

The server properly handles CORS preflight requests with authentication headers:

```http
OPTIONS / HTTP/1.1
Host: your-mcp-server.workers.dev
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization
```

## Error Responses

### 401 Unauthorized - Missing Token

```json
{
  "error": "Unauthorized",
  "message": "Missing Authorization header",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 401 Unauthorized - Invalid Format

```json
{
  "error": "Unauthorized",
  "message": "Invalid Authorization header format. Expected: Bearer <token>",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 401 Unauthorized - Invalid Token

```json
{
  "error": "Unauthorized",
  "message": "Invalid authentication token",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Deployment Configuration

### Cloudflare Workers

1. **Set authentication tokens as secrets** (recommended):
   ```bash
   # Production
   wrangler secret put MCP_AUTH_TOKEN
   
   # Development
   wrangler secret put MCP_AUTH_TOKEN --env development
   ```

2. **Multiple tokens**:
   ```bash
   # Set comma-separated tokens
   wrangler secret put MCP_AUTH_TOKENS
   # Enter: token1,token2,token3
   ```

### Environment Variables

For local development or other deployment methods:

```bash
# Single token
export MCP_AUTH_TOKEN="your_secret_token"

# Multiple tokens
export MCP_AUTH_TOKENS="token1,token2,token3"
```

## Security Best Practices

1. **Use strong, random tokens**: Generate cryptographically secure random strings
2. **Store tokens securely**: Use Cloudflare secrets, not environment variables in wrangler.toml
3. **Rotate tokens regularly**: Update tokens periodically and coordinate with clients
4. **Use different tokens per environment**: Separate tokens for dev, staging, and production
5. **Monitor access**: Track authentication failures and suspicious activity

## Token Generation

Generate secure tokens using:

```bash
# Using openssl
openssl rand -hex 32

# Using Node.js
node -e "console.log('mcp_sk_prod_' + require('crypto').randomBytes(24).toString('hex'))"

# Using Python
python -c "import secrets; print('mcp_sk_prod_' + secrets.token_hex(24))"
```

## Backward Compatibility

- **No authentication configured**: Server operates in public access mode
- **Health check endpoint**: Always accessible at `/health` regardless of authentication
- **Root endpoint**: Always accessible at `/` for service information
- **MCP operations**: Require authentication only if tokens are configured

## Testing Authentication

### Test without authentication (public mode):
```bash
curl -X POST https://your-server.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Test with authentication:
```bash
curl -X POST https://your-server.workers.dev/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token_here" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Test invalid authentication:
```bash
curl -X POST https://your-server.workers.dev/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_token" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Client Configuration

Update your MCP client configuration to include authentication:

```json
{
  "mcpServers": {
    "clg-mcp": {
      "command": "npx",
      "args": ["-y", "@your-org/clg-mcp"],
      "env": {
        "MCP_SERVER_URL": "https://your-server.workers.dev",
        "MCP_AUTH_TOKEN": "your_secret_token_here"
      }
    }
  }
}