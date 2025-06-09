# CLG-MCP: Cyndi's List Genealogy MCP Server

A Model Context Protocol (MCP) server that provides comprehensive genealogy resource discovery capabilities through web scraping of Cyndi's List. This server is designed to run on Cloudflare Workers free tier.

## Features

- **Search Genealogy Resources**: Search for resources by ancestor names, locations, or keywords
- **Browse Categories**: Navigate Cyndi's List category hierarchy
- **Resource Details**: Get detailed information about specific genealogy resources
- **Filter Resources**: Filter resources by multiple criteria (location, type, language, etc.)
- **Location-based Resources**: Find resources specific to geographic locations
- **Intelligent Caching**: Aggressive caching strategy optimized for Cloudflare free tier
- **Rate Limiting**: Built-in rate limiting to stay within API limits

## Architecture

This MCP server is built with:
- **TypeScript** for type safety
- **Cloudflare Workers** for serverless deployment
- **Cloudflare KV** for caching and rate limiting
- **SSE (Server-Sent Events)** for MCP protocol communication
- **Web Scraping** of Cyndi's List genealogy resources

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Cloudflare account (free tier)
- Wrangler CLI (`npm install -g wrangler`)

### Installation & Deployment

#### Option 1: Automated Deployment (Recommended)

1. **Clone and setup the repository**
   ```bash
   git clone <repository-url>
   cd clg-mcp
   npm run setup
   ```

2. **Authenticate with Cloudflare**
   ```bash
   wrangler login
   ```

3. **Deploy with automated script**
   ```bash
   npm run deploy:full
   ```
   
   The deployment script will:
   - Validate your environment
   - Create KV namespaces automatically
   - Build and deploy the worker
   - Verify the deployment

#### Option 2: Manual Deployment

1. **Clone and install**
   ```bash
   git clone <repository-url>
   cd clg-mcp
   npm install
   ```

2. **Authenticate with Cloudflare**
   ```bash
   wrangler login
   ```

3. **Create KV namespace**
   ```bash
   wrangler kv:namespace create "CACHE"
   wrangler kv:namespace create "CACHE" --preview
   ```
   
   Update `wrangler.toml` with the returned namespace IDs.

4. **Build and deploy**
   ```bash
   npm run build
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

## Cloudflare Account Setup

### Getting Started with Cloudflare

1. **Create a free Cloudflare account**
   - Go to [cloudflare.com](https://cloudflare.com)
   - Sign up for a free account
   - No credit card required for Workers free tier

2. **Find your account details**
   - Account ID: Found in the right sidebar of your Cloudflare dashboard
   - Subdomain: Your workers.dev subdomain (format: `your-subdomain.workers.dev`)

3. **Generate API token (optional, for automated deployment)**
   - Go to [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - Create token with `Workers:Edit` and `Zone:Read` permissions
   - Copy the token to your `.env` file

### Free Tier Limits

Cloudflare Workers free tier includes:
- **100,000 requests/day**
- **100,000 KV reads/day**
- **1,000 KV writes/day**
- **10ms CPU time per request**
- **10 Workers per account**

This MCP server is optimized to work within these limits.

## MCP Client Configuration

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
        "type": "sse",
        "url": "https://your-worker-name.your-subdomain.workers.dev"
      }
    }
  }
}
```

**Configuration file locations:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Cline (VS Code Extension)

1. Open VS Code Settings
2. Go to Extensions → Cline → MCP Servers
3. Add new server:
   - **Name**: `Cyndi's List Genealogy`
   - **URL**: `https://your-worker-name.your-subdomain.workers.dev`
   - **Type**: `sse`

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
│   │   ├── base.ts           # Base scraper with caching
│   │   ├── categories.ts     # Category hierarchy scraper
│   │   ├── search.ts         # Search functionality
│   │   └── resources.ts      # Resource details scraper
│   ├── cache/
│   │   └── manager.ts        # Cache management
│   ├── rateLimit/
│   │   └── kvLimiter.ts      # KV-based rate limiting
│   ├── utils/
│   │   ├── errors.ts         # Error handling
│   │   └── htmlParser.ts     # HTML parsing utilities
│   └── types/
│       └── index.ts          # TypeScript interfaces
├── scripts/
│   ├── deploy.ts             # Automated deployment script
│   ├── test-connection.ts    # Connection testing script
│   └── prebuild-cache.ts     # Cache prebuilding script
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
- `npm run deploy` - Simple deployment using wrangler
- `npm run deploy:full` - Full automated deployment with validation
- `npm run deploy:dev` - Deploy to development environment
- `npm run test:connection` - Test server connectivity and functionality
- `npm run prebuild-cache` - Pre-populate cache with static data
- `npm run lint` - Check code style and errors
- `npm run format` - Format code with prettier

## Caching Strategy

The server uses an aggressive caching strategy optimized for Cloudflare's free tier:

- **Static content** (categories): 30 days
- **Semi-static content** (resource details): 14 days  
- **Dynamic content** (search results): 3 days
- **Rate limiting**: 1 minute

## Rate Limiting

- 30 requests per minute per IP address
- Graceful degradation when limits are reached
- Uses Cloudflare KV for distributed rate limiting

## Troubleshooting

### Common Issues

1. **Connection timeout**
   - Check if the worker URL is correct
   - Verify the server is deployed and running
   - Test with `npm run test:connection`

2. **Rate limiting errors**
   - Reduce request frequency (30 requests/minute limit)
   - Wait a minute before retrying

3. **Tool not found errors**
   - Ensure you're using correct tool names
   - Check the available tools list above

4. **KV namespace errors**
   - Verify KV namespaces are created and configured in `wrangler.toml`
   - Check namespace IDs match between wrangler.toml and Cloudflare dashboard

5. **Build/deployment failures**
   - Run `npm run lint` to check for code issues
   - Ensure you're authenticated with `wrangler login`
   - Check Cloudflare Workers dashboard for error logs

### Debugging

- Use `npm run test:connection` to verify server connectivity
- Check Cloudflare Workers logs with `wrangler tail`
- Verify KV namespace configuration in wrangler.toml
- Test with curl commands to isolate client vs server issues:

```bash
# Test health endpoint
curl https://your-worker-name.your-subdomain.workers.dev/health

# Test MCP initialization
curl -X POST https://your-worker-name.your-subdomain.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
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

This tool is for educational and research purposes. Please respect Cyndi's List's terms of service and implement appropriate delays between requests.

---

**Need help?** Check out `example-client-config.json` for detailed setup examples and troubleshooting tips.
