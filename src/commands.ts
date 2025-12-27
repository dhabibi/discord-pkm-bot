import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

// Define slash commands
export const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!')
    .toJSON()
];

// Command handlers
export async function handlePingCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply('Pong! 🏓');
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
  }
}
