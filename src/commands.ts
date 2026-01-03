import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { saveLink } from './supabase';
import { toggleAutosave, isAutosaveEnabled } from './autosave';

// Define slash commands
export const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('save')
    .setDescription('Save a URL to the database')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('The URL to save')
        .setRequired(true))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('toggle-autosave')
    .setDescription('Toggle autosave for links in this channel')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('check-autosave')
    .setDescription('Check if autosave is enabled for this channel')
    .toJSON()
];

// Command handlers
export async function handlePingCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply('Pong! 🏓');
}

export async function handleSaveCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const url = interaction.options.getString('url', true);
  
  // Defer reply to prevent Discord interaction timeout during database operations
  await interaction.deferReply();
  
  const { data, error } = await saveLink(url);
  
  if (error || !data) {
    await interaction.editReply('❌ Failed to save link. Please try again.');
  } else {
    await interaction.editReply(`✅ Link saved: ${url}`);
  }
}

export async function handleToggleAutosaveCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;
  const newState = toggleAutosave(channelId);
  
  if (newState) {
    await interaction.reply('✅ Autosave enabled for this channel.');
  } else {
    await interaction.reply('⛔ Autosave disabled for this channel.');
  }
}

export async function handleCheckAutosaveCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;
  const isEnabled = isAutosaveEnabled(channelId);
  
  if (isEnabled) {
    await interaction.reply('✅ Autosave is **enabled** for this channel.');
  } else {
    await interaction.reply('⛔ Autosave is **disabled** for this channel.');
  }
}

export async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { commandName } = interaction;
  
  console.log(`[INFO] Command received: /${commandName} by ${interaction.user.tag}`);

  try {
    if (commandName === 'ping') {
      await handlePingCommand(interaction);
    } else if (commandName === 'save') {
      await handleSaveCommand(interaction);
    } else if (commandName === 'toggle-autosave') {
      await handleToggleAutosaveCommand(interaction);
    } else if (commandName === 'check-autosave') {
      await handleCheckAutosaveCommand(interaction);
    } else {
      await interaction.reply('❌ Unknown command.');
      console.log(`[WARN] Unknown command received: /${commandName}`);
      return;
    }
    console.log(`[INFO] Successfully responded to /${commandName}`);
  } catch (error) {
    console.error(`[ERROR] Failed to respond to /${commandName}:`, error);
    // Try to send an error message to the user
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp('❌ An error occurred while processing your command.');
      } else {
        await interaction.reply('❌ An error occurred while processing your command.');
      }
    } catch (replyError) {
      console.error(`[ERROR] Failed to send error message to user:`, replyError);
    }
  }
}
