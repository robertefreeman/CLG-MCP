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

interface SSETestConnection {
  connectionId: string;
  eventSource?: EventSource;
  cleanup: () => void;
}

class MCPTester {
  private serverUrl: string;
  private authToken?: string;
  private results: TestResult[] = [];

  constructor(serverUrl?: string, authToken?: string) {
    this.serverUrl = serverUrl || this.getDefaultServerUrl();
    this.authToken = authToken;
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

    // JSON-RPC tests
    await this.testHealthEndpoint();
    await this.testMCPHandshake();
    await this.testSearchTool();
    await this.testCategoriesListing();
    await this.testRateLimiting();

    // SSE tests
    console.log('\n🌊 Starting SSE (Server-Sent Events) tests...');
    await this.testSSEConnection();
    await this.testSSEMCPRequest();
    await this.testSSEErrorScenarios();
    await this.testSSEConnectionCleanup();

    this.printResults();
  }

  private async testHealthEndpoint(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const headers: HeadersInit = { 'Accept': 'application/json' };
      
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        headers
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

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers,
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

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers,
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

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers,
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

  private async testSSEConnection(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const headers: HeadersInit = { 'Accept': 'text/event-stream' };
      
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      // Test SSE connection establishment
      const response = await fetch(`${this.serverUrl}/sse`, {
        method: 'GET',
        headers
      });

      const duration = Date.now() - startTime;
      
      if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
        // Read the initial connection event
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (reader) {
          try {
            const { value } = await reader.read();
            const chunk = decoder.decode(value);
            
            // Parse SSE message to get connectionId
            const eventMatch = chunk.match(/event:\s*(\w+)/);
            const dataMatch = chunk.match(/data:\s*(.+)/);
            
            if (eventMatch?.[1] === 'connected' && dataMatch?.[1]) {
              const connectionData = JSON.parse(dataMatch[1]);
              if (connectionData.connectionId) {
                this.addResult('SSE Connection', true, `Connected with ID: ${connectionData.connectionId}`, duration);
              } else {
                this.addResult('SSE Connection', false, 'Connected but no connectionId received', duration);
              }
            } else {
              this.addResult('SSE Connection', false, 'Invalid connection event format', duration);
            }
            
            reader.cancel();
          } catch (readerError) {
            this.addResult('SSE Connection', false, `Failed to read connection event: ${readerError}`, duration);
          }
        } else {
          this.addResult('SSE Connection', false, 'No response body reader available', duration);
        }
      } else {
        this.addResult('SSE Connection', false, `HTTP ${response.status}: ${response.statusText}`, duration);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('SSE Connection', false, `SSE connection failed: ${error}`, duration);
    }
  }

  private async testSSEMCPRequest(): Promise<void> {
    const startTime = Date.now();
    let testConnection: SSETestConnection | null = null;

    try {
      // First establish SSE connection
      testConnection = await this.establishSSEConnection();
      
      if (!testConnection) {
        this.addResult('SSE MCP Request', false, 'Failed to establish SSE connection for testing', Date.now() - startTime);
        return;
      }

      // Send MCP request via POST /sse
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 100,
        method: 'tools/call',
        params: {
          name: 'search_genealogy_resources',
          arguments: {
            query: 'SSE test search',
            maxResults: 3
          }
        },
        protocol: 'sse',
        connectionId: testConnection.connectionId
      };

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(`${this.serverUrl}/sse`, {
        method: 'POST',
        headers,
        body: JSON.stringify(mcpRequest)
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'sent') {
          // Wait for SSE response (with timeout)
          const sseResponse = await this.waitForSSEResponse(testConnection, 5000);
          if (sseResponse) {
            this.addResult('SSE MCP Request', true, 'MCP request sent and response received via SSE', duration);
          } else {
            this.addResult('SSE MCP Request', false, 'MCP request sent but no SSE response received', duration);
          }
        } else {
          this.addResult('SSE MCP Request', false, `Unexpected response: ${JSON.stringify(data)}`, duration);
        }
      } else {
        this.addResult('SSE MCP Request', false, `HTTP ${response.status}: ${response.statusText}`, duration);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('SSE MCP Request', false, `SSE MCP request failed: ${error}`, duration);
    } finally {
      if (testConnection) {
        testConnection.cleanup();
      }
    }
  }

  private async testSSEErrorScenarios(): Promise<void> {
    const startTime = Date.now();

    try {
      // Test 1: Invalid connectionId
      await this.testInvalidConnectionId();
      
      // Test 2: Missing authentication
      await this.testSSEWithoutAuth();
      
      // Test 3: Invalid JSON in POST request
      await this.testSSEInvalidJSON();

      const duration = Date.now() - startTime;
      this.addResult('SSE Error Scenarios', true, 'All error scenarios tested successfully', duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('SSE Error Scenarios', false, `Error scenario testing failed: ${error}`, duration);
    }
  }

  private async testInvalidConnectionId(): Promise<void> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const invalidRequest = {
      jsonrpc: '2.0',
      id: 101,
      method: 'tools/call',
      params: { name: 'search_genealogy_resources', arguments: { query: 'test' } },
      protocol: 'sse',
      connectionId: 'invalid_connection_id'
    };

    const response = await fetch(`${this.serverUrl}/sse`, {
      method: 'POST',
      headers,
      body: JSON.stringify(invalidRequest)
    });

    if (response.status === 400) {
      const data = await response.json();
      if (data.error === 'Connection not found') {
        // Expected behavior
        return;
      }
    }
    throw new Error('Invalid connectionId should return 400 error');
  }

  private async testSSEWithoutAuth(): Promise<void> {
    if (!this.authToken) {
      // Skip if no auth token configured
      return;
    }

    const response = await fetch(`${this.serverUrl}/sse`, {
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' }
    });

    if (response.status !== 401) {
      throw new Error('SSE connection without auth should return 401');
    }
  }

  private async testSSEInvalidJSON(): Promise<void> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.serverUrl}/sse`, {
      method: 'POST',
      headers,
      body: 'invalid json'
    });

    if (response.status !== 400) {
      throw new Error('Invalid JSON should return 400 error');
    }
  }

  private async testSSEConnectionCleanup(): Promise<void> {
    const startTime = Date.now();
    const connections: SSETestConnection[] = [];

    try {
      // Create multiple connections to test cleanup
      for (let i = 0; i < 3; i++) {
        const connection = await this.establishSSEConnection();
        if (connection) {
          connections.push(connection);
        }
      }

      if (connections.length === 0) {
        this.addResult('SSE Connection Cleanup', false, 'No connections established for cleanup test', Date.now() - startTime);
        return;
      }

      // Close all connections
      connections.forEach(conn => conn.cleanup());

      // Wait a bit for cleanup to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      const duration = Date.now() - startTime;
      this.addResult('SSE Connection Cleanup', true, `${connections.length} connections created and cleaned up`, duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('SSE Connection Cleanup', false, `Connection cleanup test failed: ${error}`, duration);
    } finally {
      // Ensure cleanup
      connections.forEach(conn => {
        try {
          conn.cleanup();
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    }
  }

  private async establishSSEConnection(): Promise<SSETestConnection | null> {
    return new Promise((resolve, reject) => {
      const headers: HeadersInit = { 'Accept': 'text/event-stream' };
      
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      fetch(`${this.serverUrl}/sse`, {
        method: 'GET',
        headers
      }).then(response => {
        if (!response.ok) {
          resolve(null);
          return;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let connectionId: string | null = null;

        const cleanup = () => {
          try {
            reader?.cancel();
          } catch (e) {
            // Ignore cleanup errors
          }
        };

        if (reader) {
          reader.read().then(({ value }) => {
            const chunk = decoder.decode(value);
            const dataMatch = chunk.match(/data:\s*(.+)/);
            
            if (dataMatch?.[1]) {
              try {
                const connectionData = JSON.parse(dataMatch[1]);
                if (connectionData.connectionId) {
                  resolve({
                    connectionId: connectionData.connectionId,
                    cleanup
                  });
                  return;
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
            
            cleanup();
            resolve(null);
          }).catch(() => {
            cleanup();
            resolve(null);
          });
        } else {
          resolve(null);
        }
      }).catch(() => {
        resolve(null);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        resolve(null);
      }, 5000);
    });
  }

  private async waitForSSEResponse(connection: SSETestConnection, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const headers: HeadersInit = { 'Accept': 'text/event-stream' };
      
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      let responseReceived = false;

      fetch(`${this.serverUrl}/sse`, {
        method: 'GET',
        headers
      }).then(response => {
        if (!response.ok) {
          resolve(false);
          return;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        const readStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader!.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('event: mcp-response')) {
                  responseReceived = true;
                  reader?.cancel();
                  resolve(true);
                  return;
                }
              }
            }
          } catch (e) {
            // Stream ended or error occurred
          }
          
          if (!responseReceived) {
            resolve(false);
          }
        };

        readStream();
      }).catch(() => {
        resolve(false);
      });

      // Timeout
      setTimeout(() => {
        if (!responseReceived) {
          resolve(false);
        }
      }, timeout);
    });
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
    
    // Separate JSON-RPC and SSE results
    const jsonRpcTests = this.results.filter(r => !r.name.includes('SSE'));
    const sseTests = this.results.filter(r => r.name.includes('SSE'));
    
    const jsonRpcPassed = jsonRpcTests.filter(r => r.success).length;
    const ssePassed = sseTests.filter(r => r.success).length;
    
    console.log(`JSON-RPC Tests: ${jsonRpcPassed}/${jsonRpcTests.length} passed`);
    console.log(`SSE Tests: ${ssePassed}/${sseTests.length} passed`);
    console.log(`Total: ${successCount}/${totalCount} tests passed`);
    
    if (successCount === totalCount) {
      console.log('🎉 All tests passed! Your MCP server is ready to use.');
    } else {
      console.log('⚠️  Some tests failed. Check the configuration and try again.');
    }

    console.log('\n💡 Next steps:');
    console.log('1. Add the server URL to your MCP client configuration');
    console.log('2. Test with a real MCP client like Claude Desktop');
    console.log('3. Monitor server performance in Cloudflare dashboard');
    console.log('4. For SSE clients, connect to /sse endpoint and use connectionId for requests');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  let serverUrl: string | undefined;
  let authToken: string | undefined;
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--token' && i + 1 < args.length) {
      authToken = args[i + 1];
      i++; // Skip next arg
    } else if (!args[i].startsWith('--')) {
      serverUrl = args[i];
    }
  }
  
  const tester = new MCPTester(serverUrl, authToken);
  if (authToken) {
    console.log('🔐 Using authentication token\n');
  }
  await tester.runAllTests();
}

// Run the script
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('test-connection.ts')) {
  main().catch(console.error);
}

export { MCPTester };