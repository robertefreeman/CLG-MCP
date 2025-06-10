#!/usr/bin/env tsx

/**
 * Test script for MCP Server Authentication
 * Tests both authenticated and unauthenticated requests
 */

const SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:8787';
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || '';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  status?: number;
  response?: any;
}

async function testRequest(
  name: string,
  url: string,
  options: RequestInit = {}
): Promise<TestResult> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      }),
      ...options,
    });

    const data = await response.json();
    
    return {
      name,
      success: response.ok,
      message: response.ok ? 'Request successful' : `HTTP ${response.status}: ${response.statusText}`,
      status: response.status,
      response: data
    };
  } catch (error) {
    return {
      name,
      success: false,
      message: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function testHealthEndpoint(): Promise<TestResult> {
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();
    
    return {
      name: 'Health Check',
      success: response.ok,
      message: response.ok ? 'Health endpoint accessible' : `HTTP ${response.status}`,
      status: response.status,
      response: data
    };
  } catch (error) {
    return {
      name: 'Health Check',
      success: false,
      message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function runTests() {
  console.log('🔐 MCP Server Authentication Tests');
  console.log('=====================================\n');
  
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`Auth Token: ${AUTH_TOKEN ? '[SET]' : '[NOT SET]'}\n`);

  const tests: TestResult[] = [];

  // Test 1: Health endpoint (should always work)
  console.log('1. Testing health endpoint...');
  const healthTest = await testHealthEndpoint();
  tests.push(healthTest);
  console.log(`   ${healthTest.success ? '✅' : '❌'} ${healthTest.message}\n`);

  // Test 2: MCP request without authentication
  console.log('2. Testing MCP request without authentication...');
  const noAuthTest = await testRequest('No Authentication', SERVER_URL);
  tests.push(noAuthTest);
  console.log(`   ${noAuthTest.success ? '✅' : '❌'} ${noAuthTest.message}`);
  if (!noAuthTest.success && noAuthTest.response) {
    console.log(`   Response: ${JSON.stringify(noAuthTest.response, null, 2)}`);
  }
  console.log();

  // Test 3: MCP request with invalid token
  if (AUTH_TOKEN) {
    console.log('3. Testing MCP request with invalid token...');
    const invalidAuthTest = await testRequest('Invalid Authentication', SERVER_URL, {
      headers: { 'Authorization': 'Bearer invalid_token_12345' }
    });
    tests.push(invalidAuthTest);
    console.log(`   ${invalidAuthTest.success ? '✅' : '❌'} ${invalidAuthTest.message}`);
    if (!invalidAuthTest.success && invalidAuthTest.response) {
      console.log(`   Response: ${JSON.stringify(invalidAuthTest.response, null, 2)}`);
    }
    console.log();

    // Test 4: MCP request with valid token
    console.log('4. Testing MCP request with valid token...');
    const validAuthTest = await testRequest('Valid Authentication', SERVER_URL, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    tests.push(validAuthTest);
    console.log(`   ${validAuthTest.success ? '✅' : '❌'} ${validAuthTest.message}`);
    if (validAuthTest.success && validAuthTest.response?.result?.tools) {
      console.log(`   Found ${validAuthTest.response.result.tools.length} tools available`);
    }
    console.log();
  } else {
    console.log('3. Skipping authentication tests (no token provided)\n');
  }

  // Summary
  console.log('Test Summary');
  console.log('============');
  const passed = tests.filter(t => t.success).length;
  const total = tests.length;
  
  tests.forEach(test => {
    console.log(`${test.success ? '✅' : '❌'} ${test.name}: ${test.message}`);
  });
  
  console.log(`\nTotal: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection:', reason);
  process.exit(1);
});

// Run tests
runTests().catch((error) => {
  console.error('❌ Test execution failed:', error.message);
  process.exit(1);
});