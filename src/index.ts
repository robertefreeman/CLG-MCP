/// <reference types="@cloudflare/workers-types" />

import { MCPRequest, MCPResponse, MCPError, Env } from './types';
import { MCPServer } from './mcp/server';
import { handleToolCall } from './mcp/tools';
import { KVRateLimiter } from './rateLimit/kvLimiter';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Handle health check endpoint
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          service: 'clg-mcp',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'unknown'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // Return basic info for root path
      if (url.pathname === '/') {
        return new Response(JSON.stringify({
          name: 'CLG-MCP: Cyndi\'s List Genealogy MCP Server',
          version: '1.0.0',
          description: 'A Model Context Protocol server for genealogy resource discovery',
          protocol: 'MCP 2024-11-05',
          endpoints: {
            health: '/health',
            mcp: '/ (POST with MCP JSON-RPC)'
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

    // Only accept POST requests for MCP
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Set up SSE response headers
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Create a TransformStream for SSE
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Handle the request asynchronously
    ctx.waitUntil(handleMCPRequest(request, env, writer, encoder));

    return new Response(readable, { headers });
  },

  // Handle cron trigger for cache warming
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // TODO: Implement cache warming logic
    console.log('Cache warming triggered at', new Date(event.scheduledTime).toISOString());
  },
};

async function handleMCPRequest(
  request: Request,
  env: Env,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder
): Promise<void> {
  try {
    // Check rate limiting
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimiter = new KVRateLimiter(env);
    
    if (env.RATE_LIMIT_ENABLED === 'true') {
      const allowed = await rateLimiter.checkLimit(clientIp);
      if (!allowed) {
        await sendError(writer, encoder, -32000, 'Rate limit exceeded', null);
        await writer.close();
        return;
      }
    }

    // Parse the request body
    const body = await request.text();
    let mcpRequest: MCPRequest;
    
    try {
      mcpRequest = JSON.parse(body);
    } catch (error) {
      await sendError(writer, encoder, -32700, 'Parse error', null);
      await writer.close();
      return;
    }

    // Initialize MCP server
    const mcpServer = new MCPServer(env);

    // Route the request based on method
    switch (mcpRequest.method) {
      case 'initialize':
        await handleInitialize(writer, encoder, mcpRequest);
        break;
        
      case 'initialized':
        await handleInitialized(writer, encoder, mcpRequest);
        break;
        
      case 'tools/list':
        await handleToolsList(writer, encoder, mcpRequest, mcpServer);
        break;
        
      case 'tools/call':
        await handleToolCall(writer, encoder, mcpRequest, env);
        break;
        
      default:
        await sendError(writer, encoder, -32601, 'Method not found', mcpRequest.id);
    }
  } catch (error) {
    console.error('Error handling MCP request:', error);
    await sendError(writer, encoder, -32603, 'Internal error', null);
  } finally {
    await writer.close();
  }
}

async function handleInitialize(
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  request: MCPRequest
): Promise<void> {
  const response: MCPResponse = {
    jsonrpc: '2.0',
    id: request.id,
    result: {
      protocolVersion: '0.1.0',
      capabilities: {
        tools: {},
        resources: {},
      },
      serverInfo: {
        name: 'clg-mcp',
        version: '1.0.0',
        description: 'Cyndi\'s List Genealogy MCP Server',
      },
    },
  };

  await sendResponse(writer, encoder, response);
}

async function handleInitialized(
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  request: MCPRequest
): Promise<void> {
  // Just acknowledge the initialized notification
  const response: MCPResponse = {
    jsonrpc: '2.0',
    id: request.id,
    result: {},
  };

  await sendResponse(writer, encoder, response);
}

async function handleToolsList(
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  request: MCPRequest,
  mcpServer: MCPServer
): Promise<void> {
  const tools = mcpServer.getTools();
  
  const response: MCPResponse = {
    jsonrpc: '2.0',
    id: request.id,
    result: {
      tools,
    },
  };

  await sendResponse(writer, encoder, response);
}

async function sendResponse(
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  response: MCPResponse
): Promise<void> {
  const data = `data: ${JSON.stringify(response)}\n\n`;
  await writer.write(encoder.encode(data));
}

async function sendError(
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  code: number,
  message: string,
  id: string | number | null
): Promise<void> {
  const response: MCPResponse = {
    jsonrpc: '2.0',
    id: id || 0,
    error: {
      code,
      message,
    },
  };

  await sendResponse(writer, encoder, response);
}