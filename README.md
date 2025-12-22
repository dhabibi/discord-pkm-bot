# discord-pkm-bot

A minimal Discord bot built with TypeScript and discord.js that responds to slash commands.

## Features

- ✅ TypeScript for type safety
- ✅ Slash command support (`/ping`)
- ✅ Comprehensive logging (startup, commands, errors)
- ✅ Environment-based configuration

## Prerequisites

- Node.js 16.x or higher
- A Discord Bot Token (see setup instructions below)

## Setup

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" tab and click "Add Bot"
4. Under the bot's token, click "Reset Token" to get your bot token (save this!)
5. Under "Privileged Gateway Intents", enable any required intents if needed
6. Go to the "OAuth2" tab, then "URL Generator"
7. Select scopes: `bot` and `applications.commands`
8. Select bot permissions: `Send Messages`, `Use Slash Commands`
9. Copy the generated URL and open it in a browser to invite the bot to your server

### 2. Configure the Bot

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Edit `.env` and add your bot credentials:
   - `DISCORD_TOKEN`: Your bot token from step 1.4
   - `DISCORD_CLIENT_ID`: Your application ID (found on the "General Information" tab)

### 3. Build and Run

```bash
# Build TypeScript code
npm run build

# Start the bot
npm start

# Or build and run in one command
npm run dev
```

## Usage

Once the bot is running and invited to your server:

1. Type `/ping` in any channel where the bot has access
2. The bot will respond with "Pong! 🏓"

## Commands

| Command | Description |
|---------|-------------|
| `/ping` | Responds with "Pong! 🏓" |

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
│   └── index.ts          # Main bot file
├── dist/                 # Compiled JavaScript (generated)
├── .env                  # Environment variables (not in git)
├── .env.example          # Example environment file
├── .gitignore           # Git ignore rules
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── README.md           # This file
```

## Development

The bot is built with:
- [discord.js](https://discord.js.org/) - Discord API library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [dotenv](https://github.com/motdotla/dotenv) - Environment variable management

## License

ISC