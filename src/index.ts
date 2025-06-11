/// <reference types="@cloudflare/workers-types" />

import { MCPRequest, MCPResponse, Env } from './types';
import { authenticateRequestMultiKey, createUnauthorizedResponse } from './utils/auth';
import { handleSSERequest, getSSEStats } from './mcp/sse';
import { handleMCPRequestInternal } from './mcp/handler';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Handle GET requests (health check, info, SSE)
    if (request.method === 'GET') {
      const url = new URL(request.url);
      
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          service: 'clg-mcp',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'unknown',
          sse: {
            enabled: env.SSE_ENABLED !== 'false', // default to true
            stats: getSSEStats()
          }
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // SSE endpoint
      if (url.pathname === '/sse') {
        return handleSSERequest(request, env);
      }
      
      // Return basic info for root path
      if (url.pathname === '/') {
        return new Response(JSON.stringify({
          name: 'CLG-MCP: Cyndi\'s List Genealogy MCP Server',
          version: '1.0.0',
          description: 'A Model Context Protocol server for genealogy resource discovery',
          protocol: 'MCP 2024-11-05',
          transport: 'HTTP Streaming',
          protocols: ['JSON-RPC', 'SSE'],
          endpoints: {
            health: '/health',
            mcp: '/ (POST with MCP JSON-RPC)',
            sse: '/sse (GET for connection, POST for messages)'
          }
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      return new Response('Not found', { status: 404 });
    }

    // Handle POST requests (MCP JSON-RPC and SSE messages)
    if (request.method === 'POST') {
      const url = new URL(request.url);
      
      // SSE message endpoint
      if (url.pathname === '/sse') {
        return handleSSERequest(request, env);
      }
      
      // Default MCP JSON-RPC endpoint
      // Authenticate the request for MCP operations
      const auth = authenticateRequestMultiKey(request, env);
      if (!auth.isAuthenticated) {
        return createUnauthorizedResponse(auth.error);
      }

      // Set up HTTP streaming response headers
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      });

      // Handle the request and return direct JSON response
      try {
        const response = await handleMCPRequest(request, env);
        return new Response(JSON.stringify(response), {
          headers,
          status: 200
        });
      } catch (error) {
        const errorResponse: MCPResponse = {
          jsonrpc: '2.0',
          id: 0,
          error: {
            code: -32603,
            message: 'Internal server error',
          },
        };
        
        return new Response(JSON.stringify(errorResponse), {
          headers,
          status: 500
        });
      }
    }

    // Method not allowed for other HTTP methods
    return new Response('Method not allowed', { status: 405 });
  },

  // Remove cron trigger for cache warming since we no longer use caching
};

async function handleMCPRequest(
  request: Request,
  env: Env
): Promise<MCPResponse> {
  // Parse the request body
  const body = await request.text();
  let mcpRequest: MCPRequest;
  
  try {
    mcpRequest = JSON.parse(body);
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id: 0,
      error: {
        code: -32700,
        message: 'Parse error',
      },
    };
  }

  return handleMCPRequestInternal(mcpRequest, env);
}
