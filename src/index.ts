import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import { commands, handleCommand } from './commands';
import { handleMessage } from './messageHandler';

// Load environment variables
dotenv.config();

// Configuration
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

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
client.once('ready', () => {
  console.log('[INFO] Bot startup successful');
  console.log(`[INFO] Logged in as ${client.user?.tag}`);
  registerCommands();
});

// Event: Interaction created (slash command)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  await handleCommand(interaction);
});

// Event: Message created (for autosave)
client.on('messageCreate', async (message) => {
  await handleMessage(message);
});

// Error handling
client.on('error', (error) => {
  console.error('[ERROR] Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[ERROR] Unhandled promise rejection:', error);
});

// Login to Discord
client.login(TOKEN!).catch((error) => {
  console.error('[ERROR] Failed to login:', error);
  process.exit(1);
});
