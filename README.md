# discord-pkm-bot

A Discord bot built with TypeScript and discord.js that helps you manage and save links. Features slash commands, automatic link saving per channel, and Poke MCP connector integration.

## Features

- ✅ TypeScript for type safety
- ✅ Slash command support (`/ping`, `/save`, `/toggle-autosave`, `/check-autosave`)
- ✅ Channel-specific autosave for links
- ✅ Supabase integration for link storage
- ✅ **Poke MCP Connector** - Bidirectional message sync with Poke platform
- ✅ Webhook server for receiving messages from Poke
- ✅ Rate limiting and error handling
- ✅ Comprehensive logging (startup, commands, errors)
- ✅ Environment-based configuration
- ✅ Test-driven development with Jest

## Prerequisites

- Node.js 20.x or higher (required by Supabase dependencies)
- A Discord Bot Token (see setup instructions below)
- A Supabase account and project (for link storage)
- (Optional) A Poke account for MCP integration

## Setup

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" tab and click "Add Bot"
4. Under the bot's token, click "Reset Token" to get your bot token (save this!)
5. Under "Privileged Gateway Intents", enable:
   - **Message Content Intent** (required for autosave feature)
6. Go to the "OAuth2" tab, then "URL Generator"
7. Select scopes: `bot` and `applications.commands`
8. Select bot permissions: `Send Messages`, `Read Messages`, `Read Message History`, `Use Slash Commands`
9. Copy the generated URL and open it in a browser to invite the bot to your server

### 2. Set Up Supabase

1. Go to [Supabase](https://supabase.com) and create a new project
2. In the SQL Editor, create the `links` table:
   ```sql
   CREATE TABLE public.links (
     id BIGSERIAL PRIMARY KEY,
     url TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```
3. Go to Settings → API and copy:
   - Project URL (your Supabase URL)
   - Service role key (your Supabase secret key)

### 3. Set Up Poke MCP Integration (Optional)

The bot can integrate with Poke using the Message Control Protocol (MCP) for bidirectional message syncing.

#### Requirements
- A Poke account (sign up at poke.com)
- API credentials from Poke

#### Setup Steps

1. **Get Poke API Credentials:**
   - Go to [poke.com/settings/connections/integrations/new](https://poke.com/settings/connections/integrations/new)
   - Create a new custom integration
   - Copy your API key and webhook secret

2. **Configure Webhook in Poke:**
   - Set the webhook URL to: `https://your-bot-domain.com/webhook/poke`
   - The bot will start a webhook server on port 3000 by default (configurable via `WEBHOOK_PORT`)
   - Make sure the webhook endpoint is publicly accessible (use ngrok for local development)

3. **Configure Environment Variables:**
   - Set `POKE_ENABLED=true` in your `.env` file
   - Add your Poke API credentials:
     - `POKE_API_URL`: Your Poke API endpoint (e.g., `https://api.poke.com/v1`)
     - `POKE_API_KEY`: Your API key from Poke
     - `POKE_WEBHOOK_SECRET`: Your webhook secret for signature verification
     - `WEBHOOK_PORT`: Port for webhook server (default: 3000)

#### How It Works

**Discord → Poke:**
- When users send messages in Discord channels, they are automatically forwarded to Poke
- Messages include full context (channel ID, thread ID, attachments, etc.)
- Bot messages are filtered out to prevent loops

**Poke → Discord:**
- When Poke sends a webhook with a message event, it's forwarded to the specified Discord channel
- Messages include sender information and are formatted for Discord
- Signature verification ensures security

**Rate Limiting:**
- Outbound (Discord → Poke): 50 requests per 60 seconds to prevent API overload
- Inbound (Poke → Discord): 100 requests per IP per minute on webhook endpoint
- Rate-limited requests are logged and return appropriate errors

**Security:**
- Webhook signatures are verified using HMAC-SHA256
- API requests use Bearer token authentication
- Webhook endpoint has IP-based rate limiting
- All errors are logged for debugging

### 4. Configure the Bot

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Edit `.env` and add your credentials:
   - `DISCORD_TOKEN`: Your bot token from step 1.4
   - `DISCORD_CLIENT_ID`: Your application ID (found on the "General Information" tab)
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SECRET_KEY`: Your Supabase service role key
   - (Optional) Poke MCP credentials if using the integration

### 5. Build and Run

```bash
# Build TypeScript code
npm run build

# Start the bot
npm start

# Or build and run in one command
npm run dev
```

## Usage

Once the bot is running and invited to your server, you can use the following commands:

### Basic Commands

- Type `/ping` to verify the bot is working
- The bot will respond with "Pong! 🏓"

### Link Management

#### Manual Save
- Use `/save url:<your-url>` to manually save a link to the database
- Example: `/save url:https://example.com`

#### Autosave Setup
1. Use `/toggle-autosave` in any channel to enable/disable autosave for that specific channel
2. When autosave is enabled, the bot will automatically detect and save any URLs posted in that channel
3. Use `/check-autosave` to see if autosave is currently enabled for the channel

**Note:** Autosave works on a per-channel basis. Each channel can have its own autosave setting.

## Commands

| Command | Description |
|---------|-------------|
| `/ping` | Responds with "Pong! 🏓" to verify bot is working |
| `/save <url>` | Save a URL to the database |
| `/toggle-autosave` | Toggle automatic link saving for the current channel |
| `/check-autosave` | Check if autosave is enabled for the current channel |

## Poke MCP API Endpoints

When Poke integration is enabled (`POKE_ENABLED=true`), the bot exposes the following HTTP endpoints:

### Health Check
```
GET /health
```
Returns the health status of the webhook server.

**Response:**
```json
{
  "status": "ok",
  "service": "discord-poke-connector"
}
```

### API Information
```
GET /api/info
```
Returns information about the API and available endpoints.

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

### Webhook Endpoint
```
POST /webhook/poke
```
Receives webhook events from Poke. Requires signature verification.

**Headers:**
- `x-poke-signature`: HMAC-SHA256 signature of the request body
- `Content-Type`: `application/json`

**Request Body:**
```json
{
  "event": "message.received",
  "message": {
    "id": "msg_123",
    "type": "text",
    "content": "Hello from Poke!",
    "timestamp": "2024-01-01T12:00:00Z",
    "sender": {
      "id": "user_123",
      "name": "UserName",
      "platform": "poke"
    },
    "context": {
      "channelId": "discord_channel_id"
    }
  }
}
```

**Response:**
```json
{
  "success": true
}
```

**Supported Events:**
- `message.received`: New message from Poke
- `message.deleted`: Message deletion (logged, not implemented)
- `message.updated`: Message update (logged, not implemented)

### MCP Message Format

Messages exchanged between Discord and Poke follow the MCP (Message Control Protocol) format:

```typescript
interface MCPMessage {
  id: string;                    // Unique message ID
  type: 'text' | 'file' | 'media';  // Message type
  content: string;               // Message content
  timestamp: string;             // ISO 8601 timestamp
  sender: {
    id: string;                  // Sender ID
    name: string;                // Sender name
    platform: 'discord' | 'poke'; // Origin platform
  };
  context?: {
    channelId?: string;          // Channel/conversation ID
    threadId?: string;           // Thread ID (if applicable)
    replyToId?: string;          // ID of message being replied to
  };
  metadata?: Record<string, any>; // Additional data (attachments, etc.)
}
```

## Logging

The bot provides detailed logging for:

- **Startup**: Confirms when the bot successfully connects to Discord
- **Commands**: Logs each command received with username
- **Poke Integration**: Logs webhook events, message forwarding, and rate limiting
- **Errors**: Logs any errors that occur during operation

Log format: `[LEVEL] Message`

Example:
```
[INFO] Bot startup successful
[INFO] Logged in as MyBot#1234
[INFO] Poke MCP connector enabled and webhook server started
[INFO] Webhook server listening on port 3000
[INFO] Command received: /ping by User#5678
[INFO] Successfully responded to /ping
[INFO] Forwarded Discord message msg_123 to Poke
[INFO] Received Poke message event: message.received
[INFO] Forwarded Poke message to Discord channel 123456789
[WARN] Rate limit exceeded for Poke API
[ERROR] Failed to send message to Poke: Network error
```

## Project Structure

```
discord-pkm-bot/
├── src/
│   ├── index.ts              # Main bot file with event handlers
│   ├── commands.ts           # Slash command definitions and handlers
│   ├── commands.test.ts      # Tests for commands
│   ├── supabase.ts           # Supabase client and link saving logic
│   ├── supabase.test.ts      # Tests for Supabase integration
│   ├── autosave.ts           # Channel autosave state management
│   ├── autosave.test.ts      # Tests for autosave state
│   ├── messageHandler.ts     # Message event handler for autosave
│   ├── messageHandler.test.ts # Tests for message handler
│   ├── urlExtractor.ts       # URL extraction utility
│   ├── urlExtractor.test.ts  # Tests for URL extraction
│   └── mcp/                  # Poke MCP connector module
│       ├── index.ts          # MCP module exports
│       ├── types.ts          # TypeScript types for MCP protocol
│       ├── auth.ts           # Authentication and signature verification
│       ├── auth.test.ts      # Tests for authentication
│       ├── pokeClient.ts     # Poke API client with rate limiting
│       ├── pokeClient.test.ts # Tests for Poke client
│       ├── webhookServer.ts  # HTTP server for Poke webhooks
│       ├── webhookServer.test.ts # Tests for webhook server
│       ├── discordForwarder.ts # Discord to Poke message forwarder
│       └── discordForwarder.test.ts # Tests for Discord forwarder
├── dist/                     # Compiled JavaScript (generated)
├── .env                      # Environment variables (not in git)
├── .env.example              # Example environment file
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── jest.config.js           # Jest test configuration
└── README.md               # This file
```

## Development

The bot is built with:
- [discord.js](https://discord.js.org/) - Discord API library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [dotenv](https://github.com/motdotla/dotenv) - Environment variable management
- [Supabase](https://supabase.com/) - Backend as a service for data storage
- [Express](https://expressjs.com/) - Web framework for webhook server
- [Jest](https://jestjs.io/) - Testing framework

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- src/mcp/pokeClient.test.ts
```

## How It Works

### Link Saving
- The `/save` command takes a URL and stores it in the Supabase `public.links` table
- Each link is stored with a timestamp

### Autosave Feature
- Channel-specific autosave settings are stored in memory (per bot session)
- When autosave is enabled for a channel, the bot monitors all messages in that channel
- Any URLs detected in messages (starting with `http://` or `https://`) are automatically saved
- Bot messages are ignored to prevent loops
- Multiple URLs in a single message are all saved individually

### Poke MCP Integration

#### Message Flow

**Discord to Poke:**
1. User sends a message in Discord
2. Bot receives `messageCreate` event
3. Message is checked by `shouldForwardToPoke()` filter:
   - Ignores bot messages
   - Ignores system messages
   - Ignores empty messages
4. Message is converted to MCP format by `discordToMCPMessage()`
5. `PokeClient` sends message to Poke API with rate limiting
6. Success/failure is logged

**Poke to Discord:**
1. Poke sends webhook POST request to `/webhook/poke`
2. Webhook server verifies HMAC-SHA256 signature
3. Event is processed by `handlePokeMessage()`
4. For `message.received` events:
   - Channel ID is extracted from message context
   - Discord channel is fetched
   - Message is formatted and sent to Discord
5. Success/failure is logged

#### Security Features

- **Webhook Signature Verification**: All incoming webhooks are verified using HMAC-SHA256
- **API Key Authentication**: Outbound requests use Bearer token authentication
- **Rate Limiting**: Prevents API abuse (50 requests per 60 seconds)
- **Input Validation**: Message format and channel IDs are validated
- **Error Handling**: All errors are caught and logged without crashing the bot

## Troubleshooting

### Poke Integration Issues

**Webhook not receiving messages:**
- Verify `POKE_WEBHOOK_SECRET` matches the secret in Poke settings
- Check that webhook URL is publicly accessible
- Review logs for signature verification errors
- Test webhook with `/health` endpoint first

**Messages not being forwarded to Poke:**
- Ensure `POKE_ENABLED=true` in `.env`
- Verify `POKE_API_URL` and `POKE_API_KEY` are correct
- Check logs for rate limiting warnings
- Test Poke API connectivity with a simple curl request

**Rate limiting errors:**
- Reduce message frequency
- Consider increasing rate limit in `pokeClient.ts` if API allows
- Check Poke API documentation for their rate limits

### General Issues

**Bot not responding:**
- Check that bot is online in Discord
- Verify `DISCORD_TOKEN` is correct
- Ensure Message Content Intent is enabled in Discord Developer Portal

**Database errors:**
- Verify Supabase credentials
- Check that `links` table exists
- Review Supabase logs for errors
- Multiple URLs in a single message are all saved individually

## License

ISC