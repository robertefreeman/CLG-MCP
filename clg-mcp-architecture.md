# CLG-MCP: Cyndi's List Genealogy MCP Server Architecture

## Overview

The CLG-MCP (Cyndi's List Genealogy - Model Context Protocol) server is a remote SSE-based MCP server hosted on Cloudflare Workers (free tier), providing comprehensive genealogy resource discovery capabilities through web scraping of Cyndi's List.

## Architecture Design

### System Architecture

```mermaid
graph TB
    subgraph "Client Side"
        LLM[LLM/AI Assistant]
        MCP_CLIENT[MCP Client]
    end
    
    subgraph "Cloudflare Free Tier"
        WORKER[Cloudflare Worker<br/>MCP Server<br/>100k req/day]
        KV[(Cloudflare KV<br/>Cache & Rate Limiting<br/>100k reads/day<br/>1k writes/day)]
    end
    
    subgraph "External Resources"
        CYNDIS[Cyndi's List<br/>Website]
    end
    
    LLM --> MCP_CLIENT
    MCP_CLIENT -.->|SSE Connection| WORKER
    WORKER -->|Cache Check<br/>Rate Limit Check| KV
    WORKER -->|Web Scraping<br/>(on cache miss)| CYNDIS
    
    style WORKER fill:#f9f,stroke:#333,stroke-width:4px
    style KV fill:#bbf,stroke:#333,stroke-width:2px
```

### Free Tier Constraints & Solutions

| Resource | Free Tier Limit | Our Strategy |
|----------|-----------------|--------------|
| Worker Requests | 100,000/day | Aggressive caching, request coalescing |
| CPU Time | 10ms per request | Efficient parsing, minimal processing |
| KV Reads | 100,000/day | Long cache TTLs, smart key design |
| KV Writes | 1,000/day | Extended cache durations, write batching |
| KV Storage | 1GB | Compress cached data, selective caching |

## Project Structure

```
clg-mcp/
├── src/
│   ├── index.ts              # Main MCP server entry point
│   ├── mcp/
│   │   ├── server.ts         # MCP server setup
│   │   └── tools.ts          # Tool definitions
│   ├── scrapers/
│   │   ├── base.ts           # Base scraper with caching
│   │   ├── categories.ts     # Category hierarchy scraper
│   │   ├── search.ts         # Search functionality
│   │   └── resources.ts      # Resource details scraper
│   ├── cache/
│   │   ├── manager.ts        # Cache management
│   │   ├── strategies.ts     # Cache strategies
│   │   └── keys.ts           # Cache key generation
│   ├── rateLimit/
│   │   └── kvLimiter.ts      # KV-based rate limiting
│   ├── utils/
│   │   ├── compress.ts       # Data compression
│   │   ├── parser.ts         # HTML parsing utilities
│   │   └── errors.ts         # Error handling
│   └── types/
│       └── index.ts          # TypeScript interfaces
├── wrangler.toml             # Cloudflare Worker config
├── package.json
├── tsconfig.json
├── scripts/
│   └── prebuild-cache.ts     # Pre-cache static data
└── README.md
```

## MCP Tools Specification

### 1. search_genealogy_resources

Search for genealogy resources by ancestor names, locations, or keywords.

```typescript
{
  name: "search_genealogy_resources",
  description: "Search Cyndi's List for genealogy resources",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (names, locations, keywords)"
      },
      location: {
        type: "string",
        description: "Geographic location filter (optional)"
      },
      timePeriod: {
        type: "object",
        properties: {
          start: { type: "number", description: "Start year" },
          end: { type: "number", description: "End year" }
        }
      },
      resourceType: {
        type: "string",
        enum: ["census", "vital_records", "military", "immigration", 
               "newspapers", "cemeteries", "church_records", "all"],
        description: "Type of genealogy resource"
      },
      maxResults: {
        type: "number",
        description: "Maximum results to return (default: 20, max: 50)"
      }
    },
    required: ["query"]
  }
}
```

### 2. browse_categories

Browse and navigate Cyndi's List category hierarchy.

```typescript
{
  name: "browse_categories",
  description: "Browse genealogy resource categories on Cyndi's List",
  inputSchema: {
    type: "object",
    properties: {
      parentCategory: {
        type: "string",
        description: "Parent category ID (optional, null for top-level)"
      },
      includeCount: {
        type: "boolean",
        description: "Include resource count per category"
      }
    }
  }
}
```

### 3. get_resource_details

Get detailed information about a specific genealogy resource.

```typescript
{
  name: "get_resource_details",
  description: "Get detailed information about a specific genealogy resource",
  inputSchema: {
    type: "object",
    properties: {
      resourceId: {
        type: "string",
        description: "Unique resource identifier"
      },
      includeRelated: {
        type: "boolean",
        description: "Include related resources"
      }
    },
    required: ["resourceId"]
  }
}
```

### 4. filter_resources

Filter resources by multiple criteria.

```typescript
{
  name: "filter_resources",
  description: "Filter genealogy resources by multiple criteria",
  inputSchema: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        items: { type: "string" },
        description: "Category IDs to filter by"
      },
      locations: {
        type: "array",
        items: { type: "string" },
        description: "Geographic locations"
      },
      languages: {
        type: "array",
        items: { type: "string" },
        description: "Resource languages"
      },
      freeOnly: {
        type: "boolean",
        description: "Only show free resources"
      },
      hasDigitalRecords: {
        type: "boolean",
        description: "Only show resources with digital records"
      }
    }
  }
}
```

### 5. get_location_resources

Get resources specific to a geographic location.

```typescript
{
  name: "get_location_resources",
  description: "Get genealogy resources for a specific location",
  inputSchema: {
    type: "object",
    properties: {
      country: {
        type: "string",
        description: "Country name"
      },
      state: {
        type: "string",
        description: "State/Province name (optional)"
      },
      county: {
        type: "string",
        description: "County name (optional)"
      },
      city: {
        type: "string",
        description: "City name (optional)"
      }
    },
    required: ["country"]
  }
}
```

## Caching Strategy

### Cache Durations (Optimized for Free Tier)

```typescript
const CACHE_DURATIONS = {
  // Static content (rarely changes)
  categories: 30 * 24 * 60 * 60,        // 30 days
  locationIndex: 30 * 24 * 60 * 60,     // 30 days
  
  // Semi-static content
  resourceDetails: 14 * 24 * 60 * 60,   // 14 days
  categoryResources: 7 * 24 * 60 * 60,  // 7 days
  
  // Dynamic content
  searchResults: 3 * 24 * 60 * 60,      // 3 days
  
  // Rate limiting
  rateLimit: 60,                        // 1 minute
};
```

### Cache Key Strategy

```typescript
const CACHE_KEYS = {
  // Hierarchical key structure to optimize KV operations
  category: (id: string) => `cat:${id}`,
  categoryList: () => `cat:_list`,
  search: (query: string, filters: string) => `srch:${hash(query)}:${hash(filters)}`,
  resource: (id: string) => `res:${id}`,
  location: (country: string, state?: string) => `loc:${country}${state ? `:${state}` : ''}`,
  rateLimit: (ip: string, minute: number) => `rl:${ip}:${minute}`,
};
```

### Cache Optimization Techniques

1. **Response Compression**: Compress all cached data using gzip
2. **Selective Caching**: Only cache essential fields
3. **Cache Warming**: Pre-cache popular categories and locations
4. **Stale-While-Revalidate**: Serve stale content while updating

## Rate Limiting Implementation

```typescript
class KVRateLimiter {
  constructor(private env: Env) {}

  async checkLimit(clientIp: string): Promise<boolean> {
    const minute = Math.floor(Date.now() / 60000);
    const key = CACHE_KEYS.rateLimit(clientIp, minute);
    
    try {
      const count = await this.env.CACHE.get(key);
      if (count && parseInt(count) >= 30) { // 30 requests per minute
        return false;
      }
      
      // Increment counter
      await this.env.CACHE.put(
        key, 
        String((parseInt(count || '0') + 1)),
        { expirationTtl: 120 } // 2 minute TTL
      );
      
      return true;
    } catch (error) {
      // On error, allow request (fail open)
      return true;
    }
  }
}
```

## Web Scraping Strategy

### Scraping Principles

1. **Respectful Crawling**
   - User-Agent: `CLG-MCP/1.0 (Genealogy Research Tool)`
   - Respect robots.txt
   - 1-2 second delay between requests
   - Cache everything possible

2. **Target URLs**
   ```
   Base URL: https://www.cyndislist.com/
   Categories: /categories/
   Search: /search/?q={query}
   Resources: /links/{resource-id}/
   ```

3. **HTML Parsing Strategy**
   - Use Cloudflare HTMLRewriter for streaming parsing
   - Target specific CSS selectors
   - Graceful fallbacks for structure changes

### Error Handling

```typescript
class ScraperError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = true
  ) {
    super(message);
  }
}

// Error recovery strategies
const ERROR_STRATEGIES = {
  RATE_LIMITED: { delay: 60000, retries: 3 },
  PARSE_ERROR: { delay: 0, retries: 0 },
  NETWORK_ERROR: { delay: 5000, retries: 2 },
  CACHE_ERROR: { delay: 0, retries: 1 },
};
```

## Cloudflare Deployment

### Worker Configuration (wrangler.toml)

```toml
name = "clg-mcp"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"

[env.production]
kv_namespaces = [
  { binding = "CACHE", id = "your-kv-namespace-id" }
]

# Free tier limits
[limits]
cpu_ms = 10

[triggers]
crons = ["0 0 * * *"] # Daily cache warming
```

### Environment Variables

```bash
# No API keys needed for Cyndi's List scraping
# Optional configuration
CACHE_ENABLED=true
RATE_LIMIT_ENABLED=true
DEBUG_MODE=false
```

### Deployment Steps

1. **Create KV Namespace**
   ```bash
   wrangler kv:namespace create "CACHE"
   ```

2. **Build and Deploy**
   ```bash
   npm install
   npm run build
   wrangler publish
   ```

3. **Configure MCP Client**
   ```json
   {
     "mcpServers": {
       "clg-mcp": {
         "url": "https://clg-mcp.{your-subdomain}.workers.dev",
         "timeout": 30
       }
     }
   }
   ```

## Performance Optimizations

### Request Optimization

1. **Request Coalescing**: Combine multiple similar requests
2. **Partial Responses**: Return available cache data immediately
3. **Progressive Enhancement**: Basic data first, details on demand

### Data Optimization

1. **Minimize Payload Size**
   ```typescript
   // Return only essential fields
   interface MinimalResource {
     id: string;
     title: string;
     url: string;
     category: string;
     // Extended data available via get_resource_details
   }
   ```

2. **Lazy Loading**: Load detailed information only when requested

### Monitoring & Analytics

```typescript
// Track usage to stay within limits
async function trackUsage(env: Env, metric: string) {
  const date = new Date().toISOString().split('T')[0];
  const key = `stats:${date}:${metric}`;
  
  try {
    const current = await env.CACHE.get(key) || '0';
    if (parseInt(current) < 1000) { // Prevent stats from consuming write quota
      await env.CACHE.put(key, String(parseInt(current) + 1), {
        expirationTtl: 7 * 24 * 60 * 60 // 7 days
      });
    }
  } catch (error) {
    // Ignore stats errors
  }
}
```

## Challenges & Mitigations

### 1. Free Tier Limits

**Challenge**: 100k requests/day, 1k KV writes/day
**Mitigation**: 
- 30-day cache for static content
- Request coalescing
- Serve stale content when limits reached

### 2. Website Structure Changes

**Challenge**: Cyndi's List HTML changes
**Mitigation**:
- Multiple selector strategies
- Graceful degradation
- Version detection

### 3. Performance Constraints

**Challenge**: 10ms CPU time limit
**Mitigation**:
- Streaming HTML parsing
- Minimal data processing
- Pre-computed cache keys

### 4. Search Functionality

**Challenge**: No full-text search in KV
**Mitigation**:
- Cache search results by query
- Use Cyndi's List search
- Implement query normalization

## Future Enhancements

1. **Upgrade Path**: When ready for paid tier ($5/month)
   - Add Durable Objects for better rate limiting
   - Implement R2 for search index
   - Increase cache sizes

2. **Feature Additions**:
   - User bookmarks (using KV prefix)
   - Search history
   - Resource recommendations

3. **Integration Options**:
   - FamilySearch API integration
   - Ancestry.com public records
   - FindAGrave connections

## Conclusion

This architecture provides a robust, scalable MCP server for genealogy resource discovery while staying within Cloudflare's free tier limits. The aggressive caching strategy and efficient request handling ensure good performance despite the constraints.

Key benefits:
- Zero infrastructure cost
- Global edge deployment
- Automatic scaling
- No server maintenance

The design is production-ready and can serve thousands of genealogy researchers daily within the free tier limits.