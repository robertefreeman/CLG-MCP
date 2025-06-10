import { Env } from '../types';

export interface AuthResult {
  isAuthenticated: boolean;
  error?: string;
}

/**
 * Validates Bearer token authentication
 * @param request - The incoming request
 * @param env - Cloudflare environment variables
 * @returns AuthResult indicating if authentication was successful
 */
export function authenticateRequest(request: Request, env: Env): AuthResult {
  // If no auth token is configured, allow public access (backward compatibility)
  const expectedToken = env.MCP_AUTH_TOKEN;
  if (!expectedToken) {
    return { isAuthenticated: true };
  }

  // Check for Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return { 
      isAuthenticated: false, 
      error: 'Missing Authorization header' 
    };
  }

  // Validate Bearer token format
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/);
  if (!tokenMatch) {
    return { 
      isAuthenticated: false, 
      error: 'Invalid Authorization header format. Expected: Bearer <token>' 
    };
  }

  const providedToken = tokenMatch[1];
  
  // Validate token
  if (providedToken !== expectedToken) {
    return { 
      isAuthenticated: false, 
      error: 'Invalid authentication token' 
    };
  }

  return { isAuthenticated: true };
}

/**
 * Creates a standardized 401 Unauthorized response
 * @param message - Optional error message
 * @returns Response with 401 status
 */
export function createUnauthorizedResponse(message?: string): Response {
  const errorMessage = message || 'Unauthorized';
  
  return new Response(JSON.stringify({
    error: 'Unauthorized',
    message: errorMessage,
    timestamp: new Date().toISOString()
  }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'WWW-Authenticate': 'Bearer'
    }
  });
}

/**
 * Checks if multiple API keys are configured and validates against them
 * @param request - The incoming request
 * @param env - Cloudflare environment variables
 * @returns AuthResult indicating if authentication was successful
 */
export function authenticateRequestMultiKey(request: Request, env: Env): AuthResult {
  // Check for single token first (backward compatibility)
  const singleTokenResult = authenticateRequest(request, env);
  if (singleTokenResult.isAuthenticated || !env.MCP_AUTH_TOKENS) {
    return singleTokenResult;
  }

  // If single token auth failed, try multiple tokens
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return { 
      isAuthenticated: false, 
      error: 'Missing Authorization header' 
    };
  }

  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/);
  if (!tokenMatch) {
    return { 
      isAuthenticated: false, 
      error: 'Invalid Authorization header format. Expected: Bearer <token>' 
    };
  }

  const providedToken = tokenMatch[1];
  
  // Parse multiple tokens (comma-separated)
  const validTokens = env.MCP_AUTH_TOKENS.split(',').map((token: string) => token.trim());
  
  if (validTokens.includes(providedToken)) {
    return { isAuthenticated: true };
  }

  return { 
    isAuthenticated: false, 
    error: 'Invalid authentication token' 
  };
}