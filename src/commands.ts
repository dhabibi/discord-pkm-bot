import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createClient } from '@supabase/supabase-js';

// Define slash commands
export const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('recent')
    .setDescription('Displays the 5 most recent URLs')
    .toJSON()
];

// Command handlers
export async function handlePingCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply('Pong! 🏓');
}

export async function handleRecentCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    await interaction.reply('❌ Supabase configuration is missing. Please contact the bot administrator.');
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Query the database for recent URLs
    const { data, error } = await supabase
      .from('urls')
      .select('url')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('[ERROR] Supabase query failed:', error);
      await interaction.reply('❌ Failed to fetch recent URLs from the database.');
      return;
    }

    if (!data || data.length === 0) {
      await interaction.reply('📭 No URLs found in the database.');
      return;
    }

    // Format the URLs as a numbered list
    const urlList = data.map((item, index) => `${index + 1}. ${item.url}`).join('\n');
    await interaction.reply(`**Recent URLs:**\n${urlList}`);
  } catch (error) {
    console.error('[ERROR] Unexpected error in handleRecentCommand:', error);
    await interaction.reply('❌ An unexpected error occurred while fetching recent URLs.');
  }
}

export async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { commandName } = interaction;
  
  console.log(`[INFO] Command received: /${commandName} by ${interaction.user.tag}`);

  if (commandName === 'ping') {
    try {
      await handlePingCommand(interaction);
      console.log(`[INFO] Successfully responded to /${commandName}`);
    } catch (error) {
      console.error(`[ERROR] Failed to respond to /${commandName}:`, error);
    }
  } else if (commandName === 'recent') {
    try {
      await handleRecentCommand(interaction);
      console.log(`[INFO] Successfully responded to /${commandName}`);
    } catch (error) {
      console.error(`[ERROR] Failed to respond to /${commandName}:`, error);
    }
  }
}
