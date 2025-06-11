/// <reference types="@cloudflare/workers-types" />

// MCP Types
export interface MCPRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// Genealogy Resource Types
export interface GenealogyResource {
  id: string;
  title: string;
  url: string;
  description?: string;
  category: string;
  subcategory?: string;
  location?: LocationInfo;
  timeperiod?: TimePeriod;
  resourceType?: ResourceType;
  isFree?: boolean;
  hasDigitalRecords?: boolean;
  language?: string;
  lastUpdated?: string;
}

export interface LocationInfo {
  country: string;
  state?: string;
  county?: string;
  city?: string;
}

export interface TimePeriod {
  start?: number;
  end?: number;
}

export type ResourceType = 
  | "census"
  | "vital_records"
  | "military"
  | "immigration"
  | "newspapers"
  | "cemeteries"
  | "church_records"
  | "all";

export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  resourceCount?: number;
  subcategories?: Category[];
}

export interface SearchResult {
  resources: GenealogyResource[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface FilterCriteria {
  categories?: string[];
  locations?: string[];
  languages?: string[];
  freeOnly?: boolean;
  hasDigitalRecords?: boolean;
}

// Cloudflare Worker Types
export interface Env {
  DEBUG_MODE?: string;
  ENVIRONMENT?: string;
  MCP_SERVER_NAME?: string;
  MCP_SERVER_VERSION?: string;
  REQUEST_TIMEOUT?: string;
  MAX_SEARCH_RESULTS?: string;
  MCP_PROTOCOL_VERSION?: string;
  USER_AGENT?: string;
  // Authentication
  MCP_AUTH_TOKEN?: string;
  MCP_AUTH_TOKENS?: string;
  // SSE Configuration
  SSE_ENABLED?: string;
  SSE_HEARTBEAT_INTERVAL?: string;
  SSE_MAX_CONNECTIONS?: string;
}

// SSE Types
export interface SSEMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

export interface SSEConnection {
  id: string;
  controller: any; // ReadableStreamDefaultController in Cloudflare Workers
  createdAt: number;
  lastActivity: number;
}

export interface SSEResponse {
  type: 'message' | 'error' | 'close';
  data: any;
  messageId?: string;
}

export interface MCPSSERequest extends MCPRequest {
  protocol: 'sse';
  connectionId?: string;
}

export interface MCPSSEResponse extends MCPResponse {
  protocol: 'sse';
  connectionId?: string;
  timestamp?: number;
}