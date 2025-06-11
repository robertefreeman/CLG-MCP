#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Load environment variables from .env file manually
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

console.log('🔍 CLG-MCP Connection Diagnostics\n');

// 1. Check environment variables
console.log('1️⃣ Environment Variables:');
const requiredEnvVars = ['CLOUDFLARE_SUBDOMAIN', 'MCP_AUTH_TOKEN', 'MCP_AUTH_TOKENS'];
const envStatus: Record<string, boolean> = {};

for (const varName of requiredEnvVars) {
  const value = process.env[varName];
  envStatus[varName] = !!value;
  console.log(`   ${varName}: ${value ? '✅ Set' : '❌ Not set'}`);
}

// 2. Check wrangler.toml
console.log('\n2️⃣ Wrangler Configuration:');
const wranglerPath = join(process.cwd(), 'wrangler.toml');
if (existsSync(wranglerPath)) {
  console.log('   wrangler.toml: ✅ Found');
  const wranglerContent = readFileSync(wranglerPath, 'utf-8');
  const nameMatch = wranglerContent.match(/name\s*=\s*"([^"]+)"/);
  if (nameMatch) {
    console.log(`   Worker name: ${nameMatch[1]}`);
  }
} else {
  console.log('   wrangler.toml: ❌ Not found');
}

// 3. Check common MCP client config locations
console.log('\n3️⃣ MCP Client Configurations:');
const configPaths = [
  {
    name: 'Claude Desktop',
    path: join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
  },
  {
    name: 'Cline VSCode',
    path: join(homedir(), '.config', 'Code', 'User', 'settings.json')
  }
];

for (const { name, path } of configPaths) {
  if (existsSync(path)) {
    console.log(`   ${name}: ✅ Found at ${path}`);
    try {
      const content = readFileSync(path, 'utf-8');
      const hasClgMcp = content.includes('clg-mcp');
      if (hasClgMcp) {
        console.log(`      └─ Contains clg-mcp configuration`);
        
        // Extract URL if possible
        const urlMatch = content.match(/"url"\s*:\s*"([^"]+clg-mcp[^"]+)"/);
        if (urlMatch) {
          console.log(`      └─ URL: ${urlMatch[1]}`);
        }
      }
    } catch (error) {
      console.log(`      └─ ⚠️  Could not read file`);
    }
  } else {
    console.log(`   ${name}: ❓ Not found at expected location`);
  }
}

// 4. Construct expected URLs
console.log('\n4️⃣ Expected Server URLs:');
const subdomain = process.env.CLOUDFLARE_SUBDOMAIN || 'YOUR_SUBDOMAIN';
const workerUrl = `https://clg-mcp.${subdomain}.workers.dev`;
console.log(`   Production: ${workerUrl}`);
console.log(`   Local dev: http://localhost:8787`);

// 5. Check if server is accessible
console.log('\n5️⃣ Server Connectivity Test:');
async function checkServerHealth(url: string) {
  try {
    console.log(`   Testing ${url}/health ...`);
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Server is healthy: ${JSON.stringify(data)}`);
      return true;
    } else {
      console.log(`   ❌ Server responded with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

// Test both local and production URLs
(async () => {
  const localHealthy = await checkServerHealth('http://localhost:8787');
  
  if (subdomain !== 'YOUR_SUBDOMAIN') {
    const prodHealthy = await checkServerHealth(workerUrl);
  } else {
    console.log('   ⚠️  Production URL not configured (CLOUDFLARE_SUBDOMAIN not set)');
  }
  
  // 6. Diagnosis Summary
  console.log('\n📋 Diagnosis Summary:');
  
  if (!envStatus['CLOUDFLARE_SUBDOMAIN']) {
    console.log('   ❌ CLOUDFLARE_SUBDOMAIN not set - cannot connect to production server');
  }
  
  if (!envStatus['MCP_AUTH_TOKEN'] && !envStatus['MCP_AUTH_TOKENS']) {
    console.log('   ⚠️  No authentication tokens set - server may reject requests');
  }
  
  console.log('\n💡 Common Solutions:');
  console.log('   1. If using production server:');
  console.log('      - Deploy with: npm run deploy');
  console.log('      - Set CLOUDFLARE_SUBDOMAIN in .env');
  console.log('      - Update client config with correct URL');
  console.log('   2. If using local development:');
  console.log('      - Start server with: npm run dev');
  console.log('      - Configure client to use http://localhost:8787');
  console.log('   3. Check VSCode MCP extension settings');
  console.log('   4. Reload VSCode window after config changes');
})();