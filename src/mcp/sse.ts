/// <reference types="@cloudflare/workers-types" />

import { MCPRequest, SSEMessage, SSEConnection, MCPSSERequest, MCPSSEResponse, Env } from '../types';
import { authenticateRequestMultiKey, createUnauthorizedResponse } from '../utils/auth';

// Global connection manager for SSE connections
class SSEConnectionManager {
  private connections = new Map<string, SSEConnection>();
  private heartbeatInterval: number = 30000; // 30 seconds default

  constructor(heartbeatInterval?: number) {
    if (heartbeatInterval) {
      this.heartbeatInterval = heartbeatInterval;
    }
  }

  addConnection(id: string, controller: any): void {
    const connection: SSEConnection = {
      id,
      controller,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
    this.connections.set(id, connection);
  }

  removeConnection(id: string): void {
    this.connections.delete(id);
  }

  getConnection(id: string): SSEConnection | undefined {
    return this.connections.get(id);
  }

  updateActivity(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  cleanup(): void {
    const now = Date.now();
    const timeout = this.heartbeatInterval * 3; // 3x heartbeat interval

    for (const [id, connection] of this.connections.entries()) {
      if (now - connection.lastActivity > timeout) {
        try {
          connection.controller.close();
        } catch (error) {
          // Connection may already be closed
        }
        this.connections.delete(id);
      }
    }
  }

  sendHeartbeat(): void {
    const heartbeatMessage = this.formatSSEMessage({
      event: 'heartbeat',
      data: JSON.stringify({ timestamp: Date.now() })
    });

    for (const [id, connection] of this.connections.entries()) {
      try {
        connection.controller.enqueue(heartbeatMessage);
        this.updateActivity(id);
      } catch (error) {
        // Connection may be closed, remove it
        this.connections.delete(id);
      }
    }
  }

  private formatSSEMessage(message: SSEMessage): string {
    let formatted = '';
    
    if (message.id) {
      formatted += `id: ${message.id}\n`;
    }
    
    if (message.event) {
      formatted += `event: ${message.event}\n`;
    }
    
    if (message.retry) {
      formatted += `retry: ${message.retry}\n`;
    }
    
    // Handle multi-line data
    const dataLines = message.data.split('\n');
    for (const line of dataLines) {
      formatted += `data: ${line}\n`;
    }
    
    formatted += '\n';
    return formatted;
  }
}

// Global connection manager instance
const connectionManager = new SSEConnectionManager();

export function createSSEResponse(): Response {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Generate unique connection ID
  const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });

  // Add connection to manager
  connectionManager.addConnection(connectionId, {
    close: () => {
      try {
        writer.close();
      } catch (e) {
        // Writer may already be closed
      }
    },
    enqueue: (data: string) => {
      try {
        writer.write(encoder.encode(data));
      } catch (e) {
        // Writer may be closed
        connectionManager.removeConnection(connectionId);
      }
    }
  });

  // Send initial connection message
  const welcomeMessage = formatSSEMessage({
    event: 'connected',
    data: JSON.stringify({
      connectionId,
      protocol: 'sse',
      timestamp: Date.now()
    }),
    id: '0'
  });

  // Send welcome message asynchronously
  writer.write(encoder.encode(welcomeMessage)).catch(() => {
    connectionManager.removeConnection(connectionId);
  });

  return new Response(readable, { headers });
}

export async function handleSSERequest(
  request: Request,
  env: Env
): Promise<Response> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // Only allow GET for SSE endpoint establishment
  if (request.method === 'GET') {
    // Authenticate the request
    const auth = authenticateRequestMultiKey(request, env);
    if (!auth.isAuthenticated) {
      return createUnauthorizedResponse(auth.error);
    }

    return createSSEResponse();
  }

  // Handle POST requests for sending MCP messages over SSE
  if (request.method === 'POST') {
    // Authenticate the request
    const auth = authenticateRequestMultiKey(request, env);
    if (!auth.isAuthenticated) {
      return createUnauthorizedResponse(auth.error);
    }

    try {
      const body = await request.text();
      let sseRequest: MCPSSERequest;

      try {
        sseRequest = JSON.parse(body);
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Invalid JSON',
          code: -32700
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate connection ID if provided
      if (sseRequest.connectionId) {
        const connection = connectionManager.getConnection(sseRequest.connectionId);
        if (!connection) {
          return new Response(JSON.stringify({
            error: 'Connection not found',
            code: -32001
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        connectionManager.updateActivity(sseRequest.connectionId);
      }

      // Process the MCP request and send response via SSE
      const response = await processSSEMCPRequest(sseRequest, env);
      
      if (sseRequest.connectionId) {
        await sendSSEMessage(sseRequest.connectionId, response);
        return new Response(JSON.stringify({ status: 'sent' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // If no connection ID, return direct response
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal server error',
        code: -32603,
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}

export async function processSSEMCPRequest(
  request: MCPSSERequest,
  env: Env
): Promise<MCPSSEResponse> {
  // Import the MCP request handler from the handler module
  const { handleMCPRequestInternal } = await import('./handler');
  
  // Convert SSE request to regular MCP request
  const mcpRequest: MCPRequest = {
    jsonrpc: request.jsonrpc,
    id: request.id,
    method: request.method,
    params: request.params
  };

  // Process the request
  const mcpResponse = await handleMCPRequestInternal(mcpRequest, env);

  // Convert to SSE response
  const sseResponse: MCPSSEResponse = {
    ...mcpResponse,
    protocol: 'sse',
    connectionId: request.connectionId,
    timestamp: Date.now()
  };

  return sseResponse;
}

export async function sendSSEMessage(
  connectionId: string,
  response: MCPSSEResponse
): Promise<boolean> {
  const connection = connectionManager.getConnection(connectionId);
  if (!connection) {
    return false;
  }

  try {
    const message = formatSSEMessage({
      event: 'mcp-response',
      data: JSON.stringify(response),
      id: String(response.id)
    });

    connection.controller.enqueue(message);
    connectionManager.updateActivity(connectionId);
    return true;
  } catch (error) {
    // Connection may be closed
    connectionManager.removeConnection(connectionId);
    return false;
  }
}

export function formatSSEMessage(message: SSEMessage): string {
  let formatted = '';
  
  if (message.id) {
    formatted += `id: ${message.id}\n`;
  }
  
  if (message.event) {
    formatted += `event: ${message.event}\n`;
  }
  
  if (message.retry) {
    formatted += `retry: ${message.retry}\n`;
  }
  
  // Handle multi-line data
  const dataLines = message.data.split('\n');
  for (const line of dataLines) {
    formatted += `data: ${line}\n`;
  }
  
  formatted += '\n';
  return formatted;
}

// Cleanup function to be called periodically
export function cleanupSSEConnections(): void {
  connectionManager.cleanup();
}

// Heartbeat function to keep connections alive
export function sendSSEHeartbeat(): void {
  connectionManager.sendHeartbeat();
}

// Get connection stats
export function getSSEStats(): { totalConnections: number; activeConnections: number } {
  const now = Date.now();
  const timeout = 90000; // 90 seconds
  let activeConnections = 0;

  connectionManager.cleanup(); // Clean up first

  for (const connection of connectionManager['connections'].values()) {
    if (now - connection.lastActivity <= timeout) {
      activeConnections++;
    }
  }

  return {
    totalConnections: connectionManager['connections'].size,
    activeConnections
  };
}