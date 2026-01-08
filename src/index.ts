import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import { commands, handleCommand } from './commands';
import { handleMessage } from './messageHandler';
import { WebhookServer } from './mcp/webhookServer';
import { shouldForwardToPoke, forwardDiscordMessageToPoke } from './mcp/discordForwarder';

// Load environment variables
dotenv.config();

// Configuration
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const POKE_ENABLED = process.env.POKE_ENABLED === 'true';
const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || '3000', 10);

if (!TOKEN || !CLIENT_ID) {
  console.error('[ERROR] Missing required environment variables: DISCORD_TOKEN and/or DISCORD_CLIENT_ID');
  process.exit(1);
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Create webhook server for Poke integration
let webhookServer: WebhookServer | null = null;

// Register slash commands
async function registerCommands() {
  try {
    console.log('[INFO] Started refreshing application (/) commands.');
    
    const rest = new REST({ version: '10' }).setToken(TOKEN!);
    
    await rest.put(
      Routes.applicationCommands(CLIENT_ID!),
      { body: commands }
    );
    
    console.log('[INFO] Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('[ERROR] Failed to register commands:', error);
  }
}

// Event: Bot is ready
client.once('ready', async () => {
  console.log('[INFO] Bot startup successful');
  console.log(`[INFO] Logged in as ${client.user?.tag}`);
  await registerCommands();
  
  // Start webhook server for Poke integration if enabled
  if (POKE_ENABLED) {
    try {
      const webhookSecret = process.env.POKE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('[ERROR] POKE_WEBHOOK_SECRET is required when POKE_ENABLED is true');
      } else {
        webhookServer = new WebhookServer(client, webhookSecret);
        await webhookServer.start(WEBHOOK_PORT);
        console.log('[INFO] Poke MCP connector enabled and webhook server started');
      }
    } catch (error) {
      console.error('[ERROR] Failed to start Poke webhook server:', error);
    }
  } else {
    console.log('[INFO] Poke MCP connector is disabled (set POKE_ENABLED=true to enable)');
  }
});

// Event: Interaction created (slash command)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  await handleCommand(interaction);
});

// Event: Message created (for autosave and Poke forwarding)
client.on('messageCreate', async (message) => {
  // Handle autosave feature
  await handleMessage(message);
  
  // Forward to Poke if enabled
  if (POKE_ENABLED && shouldForwardToPoke(message)) {
    try {
      await forwardDiscordMessageToPoke(message);
    } catch (error) {
      console.error('[ERROR] Failed to forward message to Poke:', error);
    }
  }
});

// Error handling
client.on('error', (error) => {
  console.error('[ERROR] Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[ERROR] Unhandled promise rejection:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[INFO] Shutting down gracefully...');
  if (webhookServer) {
    await webhookServer.stop();
  }
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[INFO] Shutting down gracefully...');
  if (webhookServer) {
    await webhookServer.stop();
  }
  client.destroy();
  process.exit(0);
});

// Login to Discord
client.login(TOKEN!).catch((error) => {
  console.error('[ERROR] Failed to login:', error);
  process.exit(1);
});
