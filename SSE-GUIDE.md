# Server-Sent Events (SSE) Protocol Guide

This guide explains how to use the Server-Sent Events (SSE) protocol with the CLG-MCP server as an alternative to the standard JSON-RPC over HTTP.

## Overview

SSE provides a persistent connection between the client and server, allowing for real-time communication and streaming responses. This can be useful for:

- Long-running operations that need progress updates
- Real-time notifications
- Backward compatibility with clients that prefer streaming protocols
- Reduced latency for frequent requests

## Endpoints

### SSE Connection Endpoint
- **URL**: `/sse`
- **Method**: `GET`
- **Purpose**: Establish an SSE connection
- **Authentication**: Required via `Authorization` header

### SSE Message Endpoint  
- **URL**: `/sse`
- **Method**: `POST`
- **Purpose**: Send MCP requests over existing SSE connection
- **Authentication**: Required via `Authorization` header

## Connection Flow

### 1. Establish SSE Connection

```javascript
const eventSource = new EventSource('https://your-worker.workers.dev/sse', {
  headers: {
    'Authorization': 'Bearer your-auth-token'
  }
});
```

### 2. Handle Connection Events

```javascript
// Connection established
eventSource.addEventListener('connected', function(event) {
  const data = JSON.parse(event.data);
  const connectionId = data.connectionId;
  console.log('Connected with ID:', connectionId);
});

// MCP responses
eventSource.addEventListener('mcp-response', function(event) {
  const response = JSON.parse(event.data);
  console.log('MCP Response:', response);
});

// Heartbeat messages (every 30 seconds by default)
eventSource.addEventListener('heartbeat', function(event) {
  const data = JSON.parse(event.data);
  console.log('Heartbeat:', new Date(data.timestamp));
});

// Handle errors
eventSource.onerror = function(event) {
  console.error('SSE Error:', event);
};
```

### 3. Send MCP Requests

```javascript
async function sendMCPRequest(connectionId, mcpRequest) {
  const sseRequest = {
    ...mcpRequest,
    protocol: 'sse',
    connectionId: connectionId
  };

  const response = await fetch('https://your-worker.workers.dev/sse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-auth-token'
    },
    body: JSON.stringify(sseRequest)
  });

  return response.json();
}

// Example: List available tools
const toolsRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list'
};

sendMCPRequest(connectionId, toolsRequest);
```

## SSE Message Format

### Connection Event
```json
{
  "connectionId": "conn_1640995200000_abc123",
  "protocol": "sse",
  "timestamp": 1640995200000
}
```

### MCP Response Event
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [...]
  },
  "protocol": "sse",
  "connectionId": "conn_1640995200000_abc123",
  "timestamp": 1640995200000
}
```

### Heartbeat Event
```json
{
  "timestamp": 1640995200000
}
```

## Configuration

The SSE implementation can be configured via environment variables:

```toml
# wrangler.toml
[vars]
SSE_ENABLED = "true"                # Enable/disable SSE support
SSE_HEARTBEAT_INTERVAL = "30000"    # Heartbeat interval in milliseconds
SSE_MAX_CONNECTIONS = "100"         # Maximum concurrent connections
```

## Error Handling

### Connection Errors
- **401 Unauthorized**: Invalid or missing authentication token
- **404 Not Found**: SSE endpoint not available
- **500 Internal Server Error**: Server-side error

### Request Errors
- **400 Bad Request**: Invalid JSON or missing connection ID
- **-32001**: Connection not found (connection may have expired)
- **-32700**: Parse error (invalid JSON)
- **-32603**: Internal server error

## Browser Compatibility

SSE is supported in all modern browsers:
- Chrome/Edge: Full support
- Firefox: Full support  
- Safari: Full support
- Internet Explorer: Not supported (use polyfill if needed)

## Example Client Implementation

See `example-sse-client.html` for a complete working example that demonstrates:
- Establishing SSE connections
- Handling different event types
- Sending MCP requests
- Error handling and reconnection logic

## Performance Considerations

### Connection Management
- Connections are automatically cleaned up after 90 seconds of inactivity
- Heartbeat messages keep connections alive
- Maximum concurrent connections can be configured

### Memory Usage
- Each connection maintains minimal state (ID, timestamp, controller)
- Automatic cleanup prevents memory leaks
- Connection statistics available via `/health` endpoint

### Latency
- SSE provides lower latency than polling
- Persistent connections eliminate connection overhead
- Real-time event delivery

## Comparison with JSON-RPC

| Feature | JSON-RPC | SSE |
|---------|----------|-----|
| Connection | Request/Response | Persistent |
| Real-time | No | Yes |
| Overhead | Higher (per request) | Lower (persistent) |
| Browser Support | Universal | Modern browsers |
| Complexity | Simple | Moderate |
| Use Case | Standard operations | Real-time/streaming |

## Troubleshooting

### Connection Issues
1. Check authentication token
2. Verify server URL and `/sse` endpoint
3. Check browser console for CORS errors
4. Confirm SSE is enabled in server configuration

### Message Delivery Issues
1. Verify connection ID is valid
2. Check for connection timeouts
3. Monitor heartbeat messages
4. Review server logs for errors

### Performance Issues
1. Monitor connection count via `/health` endpoint
2. Adjust heartbeat interval if needed
3. Implement client-side reconnection logic
4. Consider connection pooling for high-volume applications

## Security Considerations

- Always use HTTPS in production
- Validate authentication tokens on every request
- Implement rate limiting if needed
- Monitor for connection abuse
- Use secure token storage in clients