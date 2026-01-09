# discord-pkm-bot

A Discord bot built with TypeScript and discord.js that helps you manage and save links. Features slash commands and automatic link saving per channel.

## Features

- ✅ TypeScript for type safety
- ✅ Slash command support (`/ping`, `/save`, `/toggle-autosave`, `/check-autosave`, `/ingest-all`)
- ✅ Channel-specific autosave for links
- ✅ Channel history ingestion with `/ingest-all` command
- ✅ Supabase integration for link storage
- ✅ Comprehensive logging (startup, commands, errors)
- ✅ Environment-based configuration
- ✅ Test-driven development with Jest

## Prerequisites

- Node.js 20.x or higher (required by Supabase dependencies)
- A Discord Bot Token (see setup instructions below)
- A Supabase account and project (for link storage)

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
3. For the `/ingest-all` command, also create the `discord_links` table:
   ```sql
   CREATE TABLE discord_links (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     message_id TEXT NOT NULL,
     channel_id TEXT NOT NULL,
     channel_name TEXT NOT NULL,
     author_id TEXT NOT NULL,
     author_name TEXT NOT NULL,
     timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
     message_content TEXT,
     url TEXT NOT NULL,
     domain TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Create indexes for common query patterns
   CREATE INDEX idx_discord_links_channel_id ON discord_links(channel_id);
   CREATE INDEX idx_discord_links_author_id ON discord_links(author_id);
   CREATE INDEX idx_discord_links_domain ON discord_links(domain);
   CREATE INDEX idx_discord_links_timestamp ON discord_links(timestamp DESC);
   CREATE INDEX idx_discord_links_url ON discord_links(url);
   ```
   
   Alternatively, you can run the provided `supabase-migration.sql` file in the SQL Editor.

4. Go to Settings → API and copy:
   - Project URL (your Supabase URL)
   - Service role key (your Supabase secret key)

### 3. Configure the Bot

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

### 4. Build and Run

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

#### Channel History Ingestion
1. Use `/ingest-all` in any text channel to scan all historical messages
2. The bot will:
   - Read through all past messages in the channel
   - Extract all URLs from non-bot messages
   - Save them to the `discord_links` table with rich metadata (message ID, author, timestamp, domain, etc.)
   - Show progress updates as it processes (e.g., "Processing... 500 messages scanned, 127 links found...")
   - Handle rate limits automatically
3. This is useful for building a comprehensive link database from existing channel history
4. The process may take several minutes for channels with thousands of messages

**Note:** The `/ingest-all` command processes messages in batches of 100 and saves links in batches of 50 to handle Discord and Supabase rate limits efficiently.

## Commands

| Command | Description |
|---------|-------------|
| `/ping` | Responds with "Pong! 🏓" to verify bot is working |
| `/save <url>` | Save a URL to the database |
| `/toggle-autosave` | Toggle automatic link saving for the current channel |
| `/check-autosave` | Check if autosave is enabled for the current channel |
| `/ingest-all` | Extract all links from channel history and save to database |

## Logging

The bot provides detailed logging for:

- **Startup**: Confirms when the bot successfully connects to Discord
- **Commands**: Logs each command received with username
- **Errors**: Logs any errors that occur during operation

Log format: `[LEVEL] Message`

Example:
```
[INFO] Bot startup successful
[INFO] Logged in as MyBot#1234
[INFO] Command received: /ping by User#5678
[INFO] Successfully responded to /ping
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
│   └── urlExtractor.test.ts  # Tests for URL extraction
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
- [Jest](https://jestjs.io/) - Testing framework

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
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

## License

ISC