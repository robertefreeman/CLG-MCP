/// <reference types="@cloudflare/workers-types" />

import { MCPRequest, MCPResponse, Env, MCPTool } from './types';
import {
  handleSearchResources as searchResourcesTool,
  handleBrowseCategories as browseCategoriesTool,
  handleGetResourceDetails as getResourceDetailsTool,
  handleFilterResources as filterResourcesTool,
  handleGetLocationResources as getLocationResourcesTool
} from './mcp/tools';
import { authenticateRequestMultiKey, createUnauthorizedResponse } from './utils/auth';

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
          transport: 'HTTP Streaming',
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

  // Route the request based on method
  switch (mcpRequest.method) {
    case 'initialize':
      return handleInitialize(mcpRequest);
      
    case 'initialized':
      return handleInitialized(mcpRequest);
      
    case 'tools/list':
      return handleToolsList(mcpRequest);
      
    case 'tools/call':
      return await handleToolCallWrapper(mcpRequest, env);
      
    default:
      return {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        error: {
          code: -32601,
          message: 'Method not found',
        },
      };
  }
}

function handleInitialize(request: MCPRequest): MCPResponse {
  return {
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
}

function handleInitialized(request: MCPRequest): MCPResponse {
  return {
    jsonrpc: '2.0',
    id: request.id,
    result: {},
  };
}

function handleToolsList(request: MCPRequest): MCPResponse {
  const tools: MCPTool[] = [
    {
      name: 'search_genealogy_resources',
      description: 'Search Cyndi\'s List for genealogy resources by ancestor names, locations, or keywords',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (names, locations, keywords)',
          },
          location: {
            type: 'string',
            description: 'Geographic location filter (optional)',
          },
          timePeriod: {
            type: 'object',
            properties: {
              start: { type: 'number', description: 'Start year' },
              end: { type: 'number', description: 'End year' },
            },
          },
          resourceType: {
            type: 'string',
            enum: ['census', 'vital_records', 'military', 'immigration',
                   'newspapers', 'cemeteries', 'church_records', 'all'],
            description: 'Type of genealogy resource',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum results to return (default: 20, max: 50)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'browse_categories',
      description: 'Browse genealogy resource categories on Cyndi\'s List',
      inputSchema: {
        type: 'object',
        properties: {
          parentCategory: {
            type: 'string',
            description: 'Parent category ID (optional, null for top-level)',
          },
          includeCount: {
            type: 'boolean',
            description: 'Include resource count per category',
          },
        },
      },
    },
    {
      name: 'get_resource_details',
      description: 'Get detailed information about a specific genealogy resource',
      inputSchema: {
        type: 'object',
        properties: {
          resourceId: {
            type: 'string',
            description: 'Unique resource identifier',
          },
          includeRelated: {
            type: 'boolean',
            description: 'Include related resources',
          },
        },
        required: ['resourceId'],
      },
    },
    {
      name: 'filter_resources',
      description: 'Filter genealogy resources by multiple criteria',
      inputSchema: {
        type: 'object',
        properties: {
          categories: {
            type: 'array',
            items: { type: 'string' },
            description: 'Category IDs to filter by',
          },
          locations: {
            type: 'array',
            items: { type: 'string' },
            description: 'Geographic locations',
          },
          languages: {
            type: 'array',
            items: { type: 'string' },
            description: 'Resource languages',
          },
          freeOnly: {
            type: 'boolean',
            description: 'Only show free resources',
          },
          hasDigitalRecords: {
            type: 'boolean',
            description: 'Only show resources with digital records',
          },
        },
      },
    },
    {
      name: 'get_location_resources',
      description: 'Get genealogy resources for a specific location',
      inputSchema: {
        type: 'object',
        properties: {
          country: {
            type: 'string',
            description: 'Country name',
          },
          state: {
            type: 'string',
            description: 'State/Province name (optional)',
          },
          county: {
            type: 'string',
            description: 'County name (optional)',
          },
          city: {
            type: 'string',
            description: 'City name (optional)',
          },
        },
        required: ['country'],
      },
    },
  ];
  
  return {
    jsonrpc: '2.0',
    id: request.id,
    result: {
      tools,
    },
  };
}

async function handleToolCallWrapper(request: MCPRequest, env: Env): Promise<MCPResponse> {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case 'search_genealogy_resources':
        result = await searchResourcesTool(args, env);
        break;

      case 'browse_categories':
        result = await browseCategoriesTool(args, env);
        break;

      case 'get_resource_details':
        result = await getResourceDetailsTool(args, env);
        break;

      case 'filter_resources':
        result = await filterResourcesTool(args, env);
        break;

      case 'get_location_resources':
        result = await getLocationResourcesTool(args, env);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32603,
        message: `Tool execution failed: ${errorMessage}`,
      },
    };
  }
}
