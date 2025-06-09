import { MCPTool } from '../types';

export class MCPServer {
  getTools(): MCPTool[] {
    return [
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
  }
}