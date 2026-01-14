# Poke MCP Connector - API Documentation

This document provides comprehensive API documentation for the Poke MCP (Message Control Protocol) connector integration.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Setup](#setup)
- [API Endpoints](#api-endpoints)
- [Message Format](#message-format)
- [Security](#security)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Examples](#examples)

## Overview

The Poke MCP connector enables bidirectional message synchronization between Discord and Poke platforms. It implements:

- **Webhook Server**: Receives messages from Poke via HTTP webhooks
- **API Client**: Sends Discord messages to Poke via REST API
- **Authentication**: HMAC-SHA256 signature verification for webhooks, Bearer token for API
- **Rate Limiting**: Prevents API overuse (50 requests per 60 seconds)
- **Error Handling**: Comprehensive logging and graceful degradation

## Architecture

```
┌─────────────────┐                    ┌─────────────────┐
│                 │   Discord Events   │                 │
│  Discord API    │◄───────────────────┤  Discord Bot    │
│                 │                    │                 │
└─────────────────┘                    └────────┬────────┘
                                               │
                                               │
                                               ▼
                                       ┌────────────────┐
                                       │ MCP Connector  │
                                       │                │
                                       │ ┌────────────┐ │
                                       │ │  Webhook   │ │
                                       │ │  Server    │ │
                                       │ └────────────┘ │
                                       │                │
                                       │ ┌────────────┐ │
                                       │ │   Poke     │ │
                                       │ │  Client    │ │
                                       │ └────────────┘ │
                                       └───────┬────────┘
                                               │
                                               │
                                               ▼
┌─────────────────┐                    ┌────────────────┐
│                 │   HTTP Webhooks    │                │
│   Poke API      │───────────────────►│  Webhook       │
│                 │                    │  Endpoint      │
└─────────────────┘                    └────────────────┘
```

## Setup

### Environment Variables

Add these to your `.env` file:

```bash
# Enable Poke integration
POKE_ENABLED=true

# Poke API configuration
POKE_API_URL=https://api.poke.com/v1
POKE_API_KEY=your_api_key_here
POKE_WEBHOOK_SECRET=your_webhook_secret_here

# Webhook server port (default: 3000)
WEBHOOK_PORT=3000
```

### Poke Platform Configuration

1. Go to [poke.com/settings/connections/integrations/new](https://poke.com/settings/connections/integrations/new)
2. Create a new custom integration
3. Set webhook URL: `https://your-domain.com/webhook/poke`
4. Copy API key and webhook secret to `.env`
5. Save configuration

## API Endpoints

### 1. Health Check

Check if the webhook server is running.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok",
  "service": "discord-poke-connector"
}
```

**Example:**
```bash
curl http://localhost:3000/health
```

---

### 2. API Information

Get information about available endpoints and API version.

**Endpoint:** `GET /api/info`

**Response:**
```json
{
  "service": "Discord-Poke MCP Connector",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "webhook": "/webhook/poke",
    "info": "/api/info"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/info
```

---

### 3. Webhook Endpoint

Receive message events from Poke.

**Endpoint:** `POST /webhook/poke`

**Headers:**
```
x-poke-signature: <hmac-sha256-signature>
Content-Type: application/json
```

**Request Body:**
```json
{
  "event": "message.received",
  "message": {
    "id": "msg_abc123",
    "type": "text",
    "content": "Hello from Poke!",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "sender": {
      "id": "user_xyz789",
      "name": "John Doe",
      "platform": "poke"
    },
    "context": {
      "channelId": "123456789012345678"
    }
  }
}
```

**Response (Success):**
```json
{
  "success": true
}
```

**Response (Invalid Signature):**
```json
{
  "error": "Invalid signature"
}
```
Status: `401 Unauthorized`

**Response (Server Error):**
```json
{
  "error": "Internal server error"
}
```
Status: `500 Internal Server Error`

**Supported Event Types:**
- `message.received`: New message from Poke (forwarded to Discord)
- `message.deleted`: Message deletion event (logged only)
- `message.updated`: Message update event (logged only)

**Example (with signature):**
```bash
# Generate signature
MESSAGE='{"event":"message.received","message":{...}}'
SIGNATURE=$(echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "your_webhook_secret" | cut -d' ' -f2)

# Send webhook
curl -X POST http://localhost:3000/webhook/poke \
  -H "Content-Type: application/json" \
  -H "x-poke-signature: $SIGNATURE" \
  -d "$MESSAGE"
```

## Message Format

### MCP Message Structure

All messages exchanged between Discord and Poke follow this TypeScript interface:

```typescript
interface MCPMessage {
  // Unique message identifier
  id: string;
  
  // Message type
  type: 'text' | 'file' | 'media';
  
  // Message content (text or description)
  content: string;
  
  // ISO 8601 timestamp
  timestamp: string;
  
  // Sender information
  sender: {
    id: string;           // User ID
    name: string;         // Username or display name
    platform: 'discord' | 'poke';  // Origin platform
  };
  
  // Optional context information
  context?: {
    channelId?: string;   // Channel or conversation ID
    threadId?: string;    // Thread ID (for threaded conversations)
    replyToId?: string;   // ID of message being replied to
  };
  
  // Optional metadata
  metadata?: {
    attachments?: Array<{
      url: string;
      name: string;
      contentType?: string;
    }>;
    embeds?: number;      // Number of embeds
    mentions?: number;    // Number of user mentions
    [key: string]: any;   // Additional custom data
  };
}
```

### Message Examples

**Text Message:**
```json
{
  "id": "msg_123",
  "type": "text",
  "content": "Hello, world!",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "sender": {
    "id": "user_456",
    "name": "Alice",
    "platform": "discord"
  },
  "context": {
    "channelId": "789"
  }
}
```

**Message with Attachments:**
```json
{
  "id": "msg_124",
  "type": "media",
  "content": "Check out this image!",
  "timestamp": "2024-01-01T12:01:00.000Z",
  "sender": {
    "id": "user_456",
    "name": "Alice",
    "platform": "discord"
  },
  "context": {
    "channelId": "789"
  },
  "metadata": {
    "attachments": [
      {
        "url": "https://cdn.discord.com/attachments/.../image.png",
        "name": "image.png",
        "contentType": "image/png"
      }
    ]
  }
}
```

**Reply Message:**
```json
{
  "id": "msg_125",
  "type": "text",
  "content": "That's great!",
  "timestamp": "2024-01-01T12:02:00.000Z",
  "sender": {
    "id": "user_457",
    "name": "Bob",
    "platform": "discord"
  },
  "context": {
    "channelId": "789",
    "replyToId": "msg_124"
  }
}
```

## Security

### Webhook Signature Verification

All incoming webhooks must include a valid HMAC-SHA256 signature in the `x-poke-signature` header.

**Signature Generation:**
```javascript
const crypto = require('crypto');

const payload = JSON.stringify(message);
const secret = process.env.POKE_WEBHOOK_SECRET;
const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');
```

**Verification Process:**
1. Extract signature from `x-poke-signature` header
2. Compute expected signature using request body and webhook secret
3. Use constant-time comparison to prevent timing attacks
4. Reject request if signatures don't match

### API Authentication

Outbound requests to Poke API use Bearer token authentication:

```
Authorization: Bearer <POKE_API_KEY>
Content-Type: application/json
```

### Best Practices

1. **Keep secrets secure**: Never commit `.env` file or expose secrets in logs
2. **Use HTTPS**: Always use HTTPS for webhook endpoints in production
3. **Rotate credentials**: Regularly rotate API keys and webhook secrets
4. **Monitor logs**: Watch for suspicious activity or repeated authentication failures
5. **Validate input**: All incoming data is validated before processing

## Rate Limiting

The connector implements multiple layers of rate limiting for security and stability.

### Outbound Rate Limiting (Discord → Poke)

Client-side rate limiting prevents overwhelming the Poke API:

**Limits:**
- Maximum: 50 requests per 60 seconds
- Window: Sliding 60-second window
- Behavior: Requests exceeding the limit are rejected immediately

**Rate Limit Response:**
```json
{
  "success": false,
  "error": "Rate limit exceeded"
}
```

### Inbound Rate Limiting (Poke → Discord)

Webhook endpoint rate limiting prevents abuse:

**Limits:**
- Maximum: 100 requests per IP per 60 seconds
- Window: Fixed 60-second window
- Behavior: Returns 429 status code when limit exceeded

**Rate Limit Response:**
```json
{
  "error": "Too many requests, please try again later"
}
```
Status: `429 Too Many Requests`

**Headers:**
```
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 1234567890
```

### Handling Rate Limits

1. **Automatic rejection**: Excess requests return error without processing
2. **Logging**: Rate limit events are logged with `[WARN]` level
3. **Retry logic**: Client should implement exponential backoff
4. **Monitoring**: Track rate limit warnings to adjust usage patterns
5. **IP-based**: Webhook rate limiting is per IP address

## Error Handling

### Error Types

**1. Authentication Errors**
```
[WARN] Invalid webhook signature
[ERROR] Invalid Poke API key
```

**2. Network Errors**
```
[ERROR] Failed to send message to Poke: Network error
[ERROR] Failed to forward message to Discord: Channel not found
```

**3. Rate Limit Errors**
```
[WARN] Rate limit exceeded for Poke API
```

**4. Validation Errors**
```
[WARN] No channel ID in message context, cannot forward to Discord
[WARN] Channel does not support sending messages
```

### Error Response Format

API errors follow this format:

```json
{
  "success": false,
  "error": "Description of the error"
}
```

Webhook errors:

```json
{
  "error": "Error description"
}
```

### Logging

All operations are logged with appropriate severity levels:

- `[INFO]`: Normal operations (message forwarded, webhook received)
- `[WARN]`: Recoverable issues (rate limit, invalid channel)
- `[ERROR]`: Failures (network errors, authentication failures)

## Examples

### Testing the Webhook Locally

Use ngrok to expose your local webhook server:

```bash
# Start ngrok
ngrok http 3000

# Note the public URL (e.g., https://abc123.ngrok.io)
# Configure this URL in Poke: https://abc123.ngrok.io/webhook/poke
```

### Testing with curl

```bash
# 1. Check health
curl http://localhost:3000/health

# 2. Get API info
curl http://localhost:3000/api/info

# 3. Send test webhook (with valid signature)
MESSAGE='{"event":"message.received","message":{"id":"test_123","type":"text","content":"Test message","timestamp":"2024-01-01T12:00:00Z","sender":{"id":"test_user","name":"Tester","platform":"poke"},"context":{"channelId":"YOUR_DISCORD_CHANNEL_ID"}}}'

SECRET="your_webhook_secret_here"
SIGNATURE=$(echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST http://localhost:3000/webhook/poke \
  -H "Content-Type: application/json" \
  -H "x-poke-signature: $SIGNATURE" \
  -d "$MESSAGE"
```

### Monitoring Logs

```bash
# Watch bot logs in real-time
npm start | tee bot.log

# Filter for Poke-related logs
npm start | grep -i poke

# Watch for errors only
npm start | grep -i error
```

### Integration Testing

Run the test suite:

```bash
# All tests
npm test

# MCP connector tests only
npm test -- src/mcp/

# Specific test file
npm test -- src/mcp/webhookServer.test.ts

# With coverage
npm run test:coverage
```

## Support

For issues or questions:

1. Check the [Troubleshooting Guide](README.md#troubleshooting) in README
2. Review logs for error messages
3. Verify configuration in `.env`
4. Test with curl commands above
5. Open an issue on GitHub with logs and configuration (redact secrets!)

## References

- [Poke MCP Documentation](https://poke.com/mcp)
- [Discord.js Documentation](https://discord.js.org/)
- [Express.js Documentation](https://expressjs.com/)
- [HMAC-SHA256 Specification](https://tools.ietf.org/html/rfc2104)
