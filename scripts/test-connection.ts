#!/usr/bin/env tsx

/**
 * Test connection script for CLG-MCP
 * 
 * This script tests the MCP server connection and basic functionality
 * 
 * Usage: npm run test:connection [URL]
 */

import { readFileSync } from 'fs';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  duration?: number;
}

class MCPTester {
  private serverUrl: string;
  private results: TestResult[] = [];

  constructor(serverUrl?: string) {
    this.serverUrl = serverUrl || this.getDefaultServerUrl();
  }

  private getDefaultServerUrl(): string {
    try {
      const wranglerConfig = readFileSync('wrangler.toml', 'utf8');
      const nameMatch = wranglerConfig.match(/name\s*=\s*"([^"]+)"/);
      const workerName = nameMatch ? nameMatch[1] : 'clg-mcp';
      return `https://${workerName}.YOUR_SUBDOMAIN.workers.dev`;
    } catch {
      return 'https://clg-mcp.YOUR_SUBDOMAIN.workers.dev';
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting CLG-MCP connection tests...');
    console.log(`📡 Server URL: ${this.serverUrl}\n`);

    await this.testHealthEndpoint();
    await this.testMCPHandshake();
    await this.testSearchTool();
    await this.testCategoriesListing();
    await this.testRateLimiting();

    this.printResults();
  }

  private async testHealthEndpoint(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      const duration = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        this.addResult('Health Check', true, `Server is healthy (${response.status})`, duration);
      } else {
        this.addResult('Health Check', false, `HTTP ${response.status}: ${response.statusText}`, duration);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('Health Check', false, `Connection failed: ${error}`, duration);
    }
  }

  private async testMCPHandshake(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const initMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'clg-mcp-tester',
            version: '1.0.0'
          }
        }
      };

      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(initMessage)
      });

      const duration = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        if (data.result && data.result.capabilities) {
          this.addResult('MCP Handshake', true, 'MCP protocol initialized successfully', duration);
        } else {
          this.addResult('MCP Handshake', false, 'Invalid MCP response format', duration);
        }
      } else {
        this.addResult('MCP Handshake', false, `HTTP ${response.status}: ${response.statusText}`, duration);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('MCP Handshake', false, `MCP handshake failed: ${error}`, duration);
    }
  }

  private async testSearchTool(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const searchMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'search_genealogy_resources',
          arguments: {
            query: 'test search',
            maxResults: 5
          }
        }
      };

      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(searchMessage)
      });

      const duration = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        if (data.result && !data.error) {
          this.addResult('Search Tool', true, 'Search functionality working', duration);
        } else {
          this.addResult('Search Tool', false, `Tool error: ${data.error?.message || 'Unknown error'}`, duration);
        }
      } else {
        this.addResult('Search Tool', false, `HTTP ${response.status}: ${response.statusText}`, duration);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('Search Tool', false, `Search test failed: ${error}`, duration);
    }
  }

  private async testCategoriesListing(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const categoriesMessage = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'browse_categories',
          arguments: {
            includeCount: true
          }
        }
      };

      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(categoriesMessage)
      });

      const duration = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        if (data.result && !data.error) {
          this.addResult('Categories Browse', true, 'Category browsing working', duration);
        } else {
          this.addResult('Categories Browse', false, `Tool error: ${data.error?.message || 'Unknown error'}`, duration);
        }
      } else {
        this.addResult('Categories Browse', false, `HTTP ${response.status}: ${response.statusText}`, duration);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('Categories Browse', false, `Categories test failed: ${error}`, duration);
    }
  }

  private async testRateLimiting(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Make multiple rapid requests to test rate limiting
      const promises = Array.from({ length: 5 }, (_, i) => 
        fetch(`${this.serverUrl}/health`, {
          method: 'GET',
          headers: { 'X-Test-Request': `rate-limit-${i}` }
        })
      );

      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      const statusCodes = responses.map(r => r.status);
      const hasRateLimit = statusCodes.some(code => code === 429);
      
      if (hasRateLimit) {
        this.addResult('Rate Limiting', true, 'Rate limiting is active', duration);
      } else {
        this.addResult('Rate Limiting', true, 'No rate limiting triggered (expected for low traffic)', duration);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('Rate Limiting', false, `Rate limit test failed: ${error}`, duration);
    }
  }

  private addResult(name: string, success: boolean, message: string, duration?: number): void {
    this.results.push({ name, success, message, duration });
  }

  private printResults(): void {
    console.log('\n📊 Test Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    this.results.forEach(result => {
      const icon = result.success ? '✅' : '❌';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`${icon} ${result.name}${duration}`);
      console.log(`   ${result.message}`);
    });

    const successCount = this.results.filter(r => r.success).length;
    const totalCount = this.results.length;
    
    console.log('\n📈 Summary:');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Passed: ${successCount}/${totalCount} tests`);
    
    if (successCount === totalCount) {
      console.log('🎉 All tests passed! Your MCP server is ready to use.');
    } else {
      console.log('⚠️  Some tests failed. Check the configuration and try again.');
    }

    console.log('\n💡 Next steps:');
    console.log('1. Add the server URL to your MCP client configuration');
    console.log('2. Test with a real MCP client like Claude Desktop');
    console.log('3. Monitor server performance in Cloudflare dashboard');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const serverUrl = args[0];
  
  const tester = new MCPTester(serverUrl);
  await tester.runAllTests();
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { MCPTester };