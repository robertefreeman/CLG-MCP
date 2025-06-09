# CLG-MCP Deployment Guide

## Quick Deployment Checklist

### ✅ Prerequisites
- [ ] Node.js 18+ installed
- [ ] Cloudflare account created (free tier)
- [ ] Wrangler CLI installed: `npm install -g wrangler`

### ✅ Repository Setup
- [ ] Repository cloned locally
- [ ] Dependencies installed: `npm run setup`
- [ ] Project builds successfully: `npm run build`

### ✅ Cloudflare Authentication
- [ ] Authenticated with Cloudflare: `wrangler login`
- [ ] Account ID identified (found in Cloudflare dashboard)
- [ ] Subdomain noted (your-subdomain.workers.dev)

### ✅ Deployment Options

#### Option A: Automated Deployment (Recommended)
- [ ] Run: `npm run deploy:full`
- [ ] Verify deployment: `npm run test:connection`

#### Option B: Manual Deployment
- [ ] Create KV namespaces: `wrangler kv:namespace create "CACHE"`
- [ ] Update `wrangler.toml` with namespace IDs
- [ ] Deploy: `npm run deploy`
- [ ] Test: `npm run test:connection`

### ✅ Post-Deployment
- [ ] Worker URL identified: `https://clg-mcp.your-subdomain.workers.dev`
- [ ] Connection test passes
- [ ] MCP client configured with worker URL
- [ ] Test search functionality

## Detailed Deployment Instructions

### 1. Environment Setup

```bash
# Clone repository
git clone <repository-url>
cd clg-mcp

# Install dependencies and build
npm run setup

# Verify everything compiles
npm run build
```

### 2. Cloudflare Configuration

```bash
# Login to Cloudflare
wrangler login

# Verify authentication
wrangler whoami
```

### 3. Automated Deployment

The automated deployment script handles everything:

```bash
npm run deploy:full
```

This script will:
1. ✅ Validate environment and authentication
2. ✅ Create KV namespaces if needed
3. ✅ Update wrangler.toml configuration
4. ✅ Build the project
5. ✅ Deploy to Cloudflare Workers
6. ✅ Verify deployment health

### 4. Manual Deployment (Alternative)

If you prefer manual control:

```bash
# Create production KV namespace
wrangler kv:namespace create "CACHE"
# Output: { binding = "CACHE", id = "abc123..." }

# Create preview KV namespace
wrangler kv:namespace create "CACHE" --preview
# Output: { binding = "CACHE", preview_id = "def456..." }

# Update wrangler.toml with the IDs shown above
# Replace "your-kv-namespace-id" with the production ID
# Replace "your-kv-preview-id" with the preview ID

# Build and deploy
npm run build
npm run deploy
```

### 5. Verify Deployment

```bash
# Test connection and functionality
npm run test:connection

# Or test with specific URL
npm run test:connection https://clg-mcp.your-subdomain.workers.dev
```

Expected output:
```
🧪 Starting CLG-MCP connection tests...
📡 Server URL: https://clg-mcp.your-subdomain.workers.dev

✅ Health Check (150ms)
   Server is healthy (200)
✅ MCP Handshake (200ms)
   MCP protocol initialized successfully
✅ Search Tool (300ms)
   Search functionality working
✅ Categories Browse (250ms)
   Category browsing working
✅ Rate Limiting (180ms)
   Rate limiting is active

🎉 All tests passed! Your MCP server is ready to use.
```

## Environment-Specific Deployments

### Development Environment

```bash
# Deploy to development environment
npm run deploy:dev

# This creates a separate worker: clg-mcp-dev
# Useful for testing before production deployment
```

### Production Environment

```bash
# Deploy to production (default)
npm run deploy:full

# Or manually
wrangler deploy --env production
```

## Finding Your Worker URL

After successful deployment, your worker will be available at:

```
https://WORKER_NAME.YOUR_SUBDOMAIN.workers.dev
```

Where:
- **WORKER_NAME**: `clg-mcp` (from wrangler.toml)
- **YOUR_SUBDOMAIN**: Your Cloudflare subdomain

### Finding Your Subdomain

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click on "Workers & Pages"
3. Your subdomain is shown in the format: `your-subdomain.workers.dev`

## Troubleshooting Deployment Issues

### Authentication Problems

```bash
# Problem: "Error: Not authenticated"
# Solution: Login to Cloudflare
wrangler login

# Problem: "Error: No account found"
# Solution: Check account association
wrangler whoami
```

### KV Namespace Issues

```bash
# Problem: "Error: KV namespace not found"
# Solution: Create namespaces
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview

# Update wrangler.toml with returned IDs
```

### Build Failures

```bash
# Problem: TypeScript compilation errors
# Solution: Fix code issues
npm run lint
npm run build

# Problem: Missing dependencies
# Solution: Reinstall
rm -rf node_modules package-lock.json
npm install
```

### Deployment Failures

```bash
# Problem: "Error: Script too large"
# Solution: The built script exceeds 1MB limit
# Check for large dependencies or excessive code

# Problem: "Error: CPU time limit exceeded"
# Solution: Optimize code for faster execution
# Current limit: 10ms per request
```

### Connection Issues

```bash
# Problem: Connection timeouts
# Solution: Verify worker is deployed and healthy
wrangler tail  # View real-time logs
npm run test:connection

# Problem: CORS errors
# Solution: Worker handles CORS automatically
# Check if request headers are correct
```

## Monitoring Your Deployment

### Real-time Logs

```bash
# View live logs from your worker
wrangler tail

# View logs for specific environment
wrangler tail --env production
```

### Cloudflare Dashboard

1. Go to [Cloudflare Workers Dashboard](https://dash.cloudflare.com)
2. Click on your worker name
3. Monitor:
   - Request volume
   - Error rates
   - Response times
   - KV operations

### Usage Analytics

The free tier includes:
- Request analytics
- Error tracking
- Performance metrics
- Geographic distribution

## Custom Domain Setup (Optional)

1. Add your domain to Cloudflare
2. Go to Workers & Pages → Custom Domains
3. Add custom domain route
4. Update MCP client configuration with new URL

## Security Considerations

- Worker runs in Cloudflare's secure sandbox
- No sensitive data stored in environment variables
- Rate limiting prevents abuse
- CORS headers configured appropriately

## Scaling Considerations

### Free Tier Limits
- 100,000 requests/day
- 100,000 KV reads/day  
- 1,000 KV writes/day
- 10ms CPU time per request

### Optimization Tips
- Cache responses aggressively
- Minimize external API calls
- Use efficient data structures
- Implement smart retry logic

## Backup and Recovery

### Configuration Backup
```bash
# Backup wrangler.toml
cp wrangler.toml wrangler.toml.backup

# Export KV data (if needed)
wrangler kv:key list --binding=CACHE --env=production
```

### Disaster Recovery
```bash
# Redeploy from clean state
npm run build
npm run deploy

# Recreate KV namespaces if lost
wrangler kv:namespace create "CACHE"
# Update wrangler.toml with new ID
```

## Next Steps After Deployment

1. **Configure MCP Client**: Add worker URL to your MCP client
2. **Test Functionality**: Verify all tools work as expected
3. **Monitor Usage**: Keep track of free tier limits
4. **Set Up Alerts**: Configure notifications for errors
5. **Plan Scaling**: Consider paid tier if usage grows

## Getting Help

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **MCP Protocol Spec**: https://spec.modelcontextprotocol.io/
- **Project Issues**: Check repository issues section
- **Community Support**: Cloudflare Discord, MCP community forums

---

**🎉 Congratulations!** Your CLG-MCP server should now be deployed and ready to help with genealogy research!