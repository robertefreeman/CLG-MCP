import { MCPRequest, MCPResponse, Env } from '../types';
import { searchResources } from '../scrapers/search';
import { browseCategories } from '../scrapers/categories';
import { getResourceDetails } from '../scrapers/resources';
import { filterResources, getLocationResources } from '../scrapers/resources';

export async function handleToolCall(
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  request: MCPRequest,
  env: Env
): Promise<void> {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case 'search_genealogy_resources':
        result = await handleSearchResources(args, env);
        break;

      case 'browse_categories':
        result = await handleBrowseCategories(args, env);
        break;

      case 'get_resource_details':
        result = await handleGetResourceDetails(args, env);
        break;

      case 'filter_resources':
        result = await handleFilterResources(args, env);
        break;

      case 'get_location_resources':
        result = await handleGetLocationResources(args, env);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    const response: MCPResponse = {
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

    await sendResponse(writer, encoder, response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32603,
        message: `Tool execution failed: ${errorMessage}`,
      },
    };

    await sendResponse(writer, encoder, response);
  }
}

async function handleSearchResources(args: any, env: Env): Promise<any> {
  // TODO: Implement actual search logic
  // For now, return stub data
  return {
    resources: [
      {
        id: 'stub-1',
        title: 'Example Genealogy Resource',
        url: 'https://example.com',
        description: 'This is a stub resource for testing',
        category: 'general',
      },
    ],
    totalCount: 1,
    page: 1,
    pageSize: 20,
  };
}

async function handleBrowseCategories(args: any, env: Env): Promise<any> {
  // TODO: Implement actual category browsing logic
  // For now, return stub data
  return {
    categories: [
      {
        id: 'cat-1',
        name: 'Birth Records',
        description: 'Birth certificates and registrations',
        resourceCount: 100,
      },
      {
        id: 'cat-2',
        name: 'Census Records',
        description: 'Population census data',
        resourceCount: 150,
      },
    ],
  };
}

async function handleGetResourceDetails(args: any, env: Env): Promise<any> {
  // TODO: Implement actual resource details logic
  // For now, return stub data
  return {
    id: args.resourceId,
    title: 'Detailed Resource Information',
    url: 'https://example.com/resource',
    description: 'This is a detailed view of the resource',
    category: 'general',
    lastUpdated: new Date().toISOString(),
  };
}

async function handleFilterResources(args: any, env: Env): Promise<any> {
  // TODO: Implement actual filtering logic
  // For now, return stub data
  return {
    resources: [],
    totalCount: 0,
    filters: args,
  };
}

async function handleGetLocationResources(args: any, env: Env): Promise<any> {
  // TODO: Implement actual location-based resource logic
  // For now, return stub data
  return {
    location: {
      country: args.country,
      state: args.state,
      county: args.county,
      city: args.city,
    },
    resources: [],
    totalCount: 0,
  };
}

async function sendResponse(
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  response: MCPResponse
): Promise<void> {
  const data = `data: ${JSON.stringify(response)}\n\n`;
  await writer.write(encoder.encode(data));
}