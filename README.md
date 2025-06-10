# CLG-MCP: Cyndi's List Genealogy MCP Server

A simplified Model Context Protocol (MCP) server that provides genealogy resource discovery capabilities through web scraping of Cyndi's List. This server is designed to run on Cloudflare Workers free tier with a clean, cache-free architecture.

## Features

- **Search Genealogy Resources**: Search for resources by ancestor names, locations, or keywords
- **Browse Categories**: Navigate Cyndi's List category hierarchy
- **Resource Details**: Get detailed information about specific genealogy resources
- **Filter Resources**: Filter resources by multiple criteria (location, type, language, etc.)
- **Location-based Resources**: Find resources specific to geographic locations
- **HTTP Streaming**: Modern HTTP streaming transport for better performance
- **Authentication Support**: Optional Bearer token authentication to secure server access
- **Simplified Architecture**: Clean design without caching or rate limiting complexity

## Architecture

This MCP server is built with:
- **TypeScript** for type safety
- **Cloudflare Workers** for serverless deployment
- **HTTP Streaming** for MCP protocol communication
- **Web Scraping** of Cyndi's List genealogy resources
- **Respectful delays** to ensure responsible scraping

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Cloudflare account (free tier)
- Wrangler CLI (`npm install -g wrangler`)

### Installation & Deployment

#### Automated Setup

1. **Clone and setup the repository**
   ```bash
   git clone <repository-url>
   cd clg-mcp
   npm run setup
   ```

2. **Authenticate with Cloudflare**
   Before deploying to Cloudflare Workers, you must authenticate Wrangler with your Cloudflare account. This is a one-time setup per machine.
   
   ```bash
   wrangler login
   ```
   
   This command will:
   - Open your default web browser
   - Redirect you to Cloudflare's authentication page
   - Prompt you to log in to your Cloudflare account
   - Grant Wrangler permission to manage your Workers
   
   **Verify your authentication:**
   ```bash
   wrangler whoami
   ```
   
   This should display your Cloudflare account email and account ID. If you see an error, repeat the login process.

3. **Deploy**
   ```bash
   npm run deploy
   ```

### Testing Your Deployment

After deployment, test your server:

```bash
npm run test:connection
```

Or test with a specific URL:
```bash
npm run test:connection https://your-worker-name.your-subdomain.workers.dev
```

### Development

Run the development server locally:
```bash
npm run dev
```

## Authentication

The CLG-MCP server now supports optional Bearer token authentication to secure access to genealogy resources. Authentication is **optional** and **backward compatible** - if no authentication tokens are configured, the server operates in public access mode.

### Quick Setup

1. **Generate a secure token**:
   ```bash
   # Using openssl
   openssl rand -hex 32
   
   # Using Node.js
   node -e "console.log('mcp_sk_prod_' + require('crypto').randomBytes(24).toString('hex'))"
   ```

2. **Configure authentication** via Wrangler secrets (recommended):
   ```bash
   # Single token
   wrangler secret put MCP_AUTH_TOKEN
   
   # Multiple tokens (comma-separated)
   wrangler secret put MCP_AUTH_TOKENS
   ```

3. **Test authentication**:
   ```bash
   npm run test:auth
   ```

### Usage

When authentication is enabled, clients must include the Bearer token in the Authorization header:

```http
Authorization: Bearer your_secret_token_here
```

### Authentication Options

- **Single Token**: Set `MCP_AUTH_TOKEN` environment variable
- **Multiple Tokens**: Set `MCP_AUTH_TOKENS` with comma-separated values
- **No Authentication**: Leave both unset for public access mode

For detailed authentication setup, security best practices, and troubleshooting, see [`AUTHENTICATION.md`](AUTHENTICATION.md).

## Cloudflare Account Setup

### Getting Started with Cloudflare

1. **Create a free Cloudflare account**
   - Go to [cloudflare.com](https://cloudflare.com)
   - Sign up for a free account
   - No credit card required for Workers free tier

2. **Find your account details**
   - Account ID: Found in the right sidebar of your Cloudflare dashboard
   - Subdomain: Your workers.dev subdomain (format: `your-subdomain.workers.dev`)

### Free Tier Limits

Cloudflare Workers free tier includes:
- **100,000 requests/day**
- **10ms CPU time per request**
- **10 Workers per account**

This simplified MCP server is optimized to work well within these limits.

## MCP Client Configuration

### GitHub Copilot VS Code Extension

1. **Install the GitHub Copilot VS Code Extension**
   - Open Visual Studio Code
   - Go to Extensions (Ctrl+Shift+X or Cmd+Shift+X)
   - Search for "GitHub Copilot" and install it
   - Sign in with your GitHub account that has Copilot access

2. **Configure MCP Server Connection**
   - Open VS Code Settings (File → Preferences → Settings)
   - Search for "GitHub Copilot MCP"
   - Add a new MCP server configuration:
     - **Server Name**: `clg-mcp`
     - **Server URL**: `https://your-worker-name.your-subdomain.workers.dev`
     - **Transport Type**: `http`
     - **Authorization**: `Bearer your_token_here` (if authentication is enabled)

3. **Alternative Configuration via settings.json**
   Add to your VS Code `settings.json`:
   ```json
   {
     "github.copilot.mcp.servers": {
       "clg-mcp": {
         "url": "https://your-worker-name.your-subdomain.workers.dev",
         "transport": {
           "type": "http"
         },
         "headers": {
           "Authorization": "Bearer your_token_here"
         }
       }
     }
   }
   ```
   
   **Note**: Only include the `headers` section if authentication is enabled on your server.

4. **Verify Connection**
   - Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
   - Run "GitHub Copilot: Show MCP Servers"
   - Verify that `clg-mcp` appears in the list with a connected status

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "clg-mcp": {
      "command": "node",
      "args": [],
      "env": {},
      "transport": {
        "type": "http",
        "url": "https://your-worker-name.your-subdomain.workers.dev",
        "headers": {
          "Authorization": "Bearer your_token_here"
        }
      }
    }
  }
}
```

**Note**: Only include the `headers` section if authentication is enabled on your server.

**Configuration file locations:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Kilo Code (VS Code Extension)

1. **Install Kilo Code Extension**
   - Open Visual Studio Code
   - Go to Extensions (Ctrl+Shift+X or Cmd+Shift+X)
   - Search for "Kilo Code" and install it

2. **Configure MCP Server**
   - Open VS Code Settings (File → Preferences → Settings)
   - Go to Extensions → Kilo Code → MCP Servers
   - Add new server:
     - **Name**: `Cyndi's List Genealogy`
     - **URL**: `https://your-worker-name.your-subdomain.workers.dev`
     - **Transport Type**: `http`
     - **Authorization Header**: `Bearer your_token_here` (if authentication is enabled)

3. **Alternative Configuration**
   Add to your Kilo Code configuration file:
   ```json
   {
     "mcpServers": {
       "clg-mcp": {
         "transport": {
           "type": "http",
           "url": "https://your-worker-name.your-subdomain.workers.dev",
           "headers": {
             "Authorization": "Bearer your_token_here"
           }
         }
       }
     }
   }
   ```
   
   **Note**: Only include the `headers` section if authentication is enabled on your server.

### Custom MCP Clients

See `example-client-config.json` for detailed configuration examples and usage patterns.

### Finding Your Worker URL

After deployment, your worker URL will be:
```
https://WORKER_NAME.YOUR_SUBDOMAIN.workers.dev
```

- **WORKER_NAME**: Defined in `wrangler.toml` (default: `clg-mcp`)
- **YOUR_SUBDOMAIN**: Your Cloudflare subdomain (found in dashboard)

You can also set up a custom domain in the Cloudflare dashboard.

## Available Tools

### 1. search_genealogy_resources
Search for genealogy resources by names, locations, or keywords.

**Parameters:**
- `query` (required): Search query
- `location` (optional): Geographic location filter
- `timePeriod` (optional): Time period with start/end years
- `resourceType` (optional): Type of genealogy resource
- `maxResults` (optional): Maximum results (default: 20, max: 50)

**Example:**
```json
{
  "tool": "search_genealogy_resources",
  "arguments": {
    "query": "Smith family birth records",
    "location": "Ohio",
    "maxResults": 20
  }
}
```

### 2. browse_categories
Browse genealogy resource categories.

**Parameters:**
- `parentCategory` (optional): Parent category ID
- `includeCount` (optional): Include resource count per category

**Example:**
```json
{
  "tool": "browse_categories",
  "arguments": {
    "includeCount": true
  }
}
```

### 3. get_resource_details
Get detailed information about a specific resource.

**Parameters:**
- `resourceId` (required): Unique resource identifier
- `includeRelated` (optional): Include related resources

### 4. filter_resources
Filter resources by multiple criteria.

**Parameters:**
- `categories` (optional): Category IDs to filter by
- `locations` (optional): Geographic locations
- `languages` (optional): Resource languages
- `freeOnly` (optional): Only show free resources
- `hasDigitalRecords` (optional): Only show resources with digital records

### 5. get_location_resources
Get resources for a specific location.

**Parameters:**
- `country` (required): Country name
- `state` (optional): State/Province name
- `county` (optional): County name
- `city` (optional): City name

**Example:**
```json
{
  "tool": "get_location_resources",
  "arguments": {
    "country": "Ireland",
    "county": "Cork"
  }
}
```

## Project Structure

```
clg-mcp/
├── src/
│   ├── index.ts              # Main MCP server entry point
│   ├── mcp/
│   │   ├── server.ts         # MCP server setup
│   │   └── tools.ts          # Tool definitions and handlers
│   ├── scrapers/
│   │   ├── base.ts           # Base scraper with common functionality
│   │   ├── categories.ts     # Category hierarchy scraper
│   │   ├── search.ts         # Search functionality
│   │   └── resources.ts      # Resource details scraper
│   ├── utils/
│   │   ├── errors.ts         # Error handling
│   │   └── htmlParser.ts     # HTML parsing utilities
│   └── types/
│       └── index.ts          # TypeScript interfaces
├── scripts/
│   ├── deploy.ts             # Automated deployment script
│   └── test-connection.ts    # Connection testing script
├── wrangler.toml             # Cloudflare Worker config
├── package.json
├── tsconfig.json
├── .env.example              # Environment variables template
├── example-client-config.json # MCP client configuration examples
└── README.md
```

## Scripts

- `npm run setup` - Install dependencies and build project
- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run development server locally
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run test:connection` - Test server connectivity and functionality
- `npm run test:auth` - Test authentication functionality
- `npm run lint` - Check code style and errors
- `npm run format` - Format code with prettier

## Simplified Architecture Benefits

This refactored version provides several advantages:

- **No KV Dependencies**: Eliminates the need for Cloudflare KV namespace setup
- **Simplified Deployment**: Easier setup process without cache configuration
- **HTTP Streaming**: Modern transport protocol for better compatibility
- **Reduced Complexity**: Cleaner codebase without caching infrastructure
- **Better Error Handling**: Direct HTTP responses instead of SSE complexity
- **Respectful Scraping**: Built-in delays ensure responsible website access

## Responsible Usage

The server includes built-in delays between requests to ensure respectful scraping:
- Search requests: 1000ms delay
- Category browsing: 800ms delay  
- Resource details: 1000ms delay
- Filter operations: 1200ms delay

## Troubleshooting

### Common Issues

1. **Connection timeout**
   - Check if the worker URL is correct
   - Verify the server is deployed and running
   - Test with `npm run test:connection`

2. **Tool not found errors**
   - Ensure you're using correct tool names
   - Check the available tools list above

3. **Build/deployment failures**
   - Run `npm run lint` to check for code issues
   - Ensure you're authenticated with `wrangler login`
   - Check Cloudflare Workers dashboard for error logs

### Debugging

- Use `npm run test:connection` to verify server connectivity
- Check Cloudflare Workers logs with `wrangler tail`
- Test with curl commands to isolate client vs server issues:

```bash
# Test health endpoint
curl https://your-worker-name.your-subdomain.workers.dev/health

# Test MCP initialization
curl -X POST https://your-worker-name.your-subdomain.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'

# Test with authentication (if enabled)
curl -X POST https://your-worker-name.your-subdomain.workers.dev \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token_here" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Getting Help

1. Check the Cloudflare Workers documentation
2. Review the MCP protocol specification
3. Look at `example-client-config.json` for configuration examples
4. Check the issues section of this repository

## Environment Configuration

Copy `.env.example` to `.env` and configure as needed:

```bash
cp .env.example .env
```

Most environment variables are optional and have sensible defaults. See `.env.example` for detailed configuration options.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run `npm run lint` and `npm run build`
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Disclaimer

This tool is for educational and research purposes. Please respect Cyndi's List's terms of service and the built-in delays for responsible scraping.

---

**Need help?** Check out `example-client-config.json` for detailed setup examples and troubleshooting tips.
