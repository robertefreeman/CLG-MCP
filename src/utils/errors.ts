export class ScraperError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'ScraperError';
  }
}

export class CacheError extends Error {
  constructor(message: string, public operation: string) {
    super(message);
    this.name = 'CacheError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public resetAt?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export const ERROR_CODES = {
  RATE_LIMITED: 'RATE_LIMITED',
  PARSE_ERROR: 'PARSE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
} as const;

export const ERROR_STRATEGIES = {
  [ERROR_CODES.RATE_LIMITED]: { delay: 60000, retries: 3 },
  [ERROR_CODES.PARSE_ERROR]: { delay: 0, retries: 0 },
  [ERROR_CODES.NETWORK_ERROR]: { delay: 5000, retries: 2 },
  [ERROR_CODES.CACHE_ERROR]: { delay: 0, retries: 1 },
  [ERROR_CODES.NOT_FOUND]: { delay: 0, retries: 0 },
  [ERROR_CODES.INVALID_INPUT]: { delay: 0, retries: 0 },
};

export function createErrorResponse(error: Error, id: string | number): any {
  let code = -32603; // Internal error
  let message = 'Internal server error';

  if (error instanceof ScraperError) {
    switch (error.code) {
      case ERROR_CODES.RATE_LIMITED:
        code = -32000;
        message = 'Rate limit exceeded';
        break;
      case ERROR_CODES.NOT_FOUND:
        code = -32001;
        message = 'Resource not found';
        break;
      case ERROR_CODES.INVALID_INPUT:
        code = -32602;
        message = 'Invalid parameters';
        break;
      default:
        message = error.message;
    }
  } else if (error instanceof RateLimitError) {
    code = -32000;
    message = error.message;
  } else if (error instanceof CacheError) {
    code = -32603;
    message = 'Cache operation failed';
  }

  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data: {
        type: error.constructor.name,
        originalMessage: error.message,
      },
    },
  };
}