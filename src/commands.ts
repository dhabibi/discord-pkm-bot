import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, NewsChannel, ThreadChannel, Collection, Message } from 'discord.js';
import { saveLink, saveDiscordLinks, DiscordLink } from './supabase';
import { toggleAutosave, isAutosaveEnabled } from './autosave';
import { extractUrls, extractDomain } from './urlExtractor';

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
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ingest-all')
    .setDescription('Extract all links from channel history and save to database')
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

export async function handleIngestAllCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const channel = interaction.channel;
  
  if (!channel || !channel.isTextBased() || !('messages' in channel)) {
    await interaction.reply('❌ This command can only be used in text channels.');
    return;
  }

  // Type assertion for channels that support messages
  const textChannel = channel as TextChannel | NewsChannel | ThreadChannel;

  // Defer reply since this operation will take time
  await interaction.deferReply();

  try {
    const channelName = ('name' in textChannel && textChannel.name) ? textChannel.name : 'Unknown Channel';
    let totalMessages = 0;
    let totalLinks = 0;
    const allLinks: DiscordLink[] = [];
    
    // Configuration constants
    const MESSAGE_FETCH_BATCH_SIZE = 100; // Discord.js recommended batch size
    const LINK_SAVE_BATCH_SIZE = 50; // Supabase batch insert size
    const MAX_MESSAGE_CONTENT_LENGTH = 500; // Truncate message content to this length
    const RATE_LIMIT_DELAY_MS = 1000; // Delay between batches to respect rate limits
    
    let lastMessageId: string | undefined = undefined;

    console.log(`[INFO] Starting ingest-all for channel ${textChannel.id} (${channelName})`);

    // Fetch messages in batches
    while (true) {
      let messages: Collection<string, Message>;
      
      if (lastMessageId) {
        messages = await textChannel.messages.fetch({ limit: MESSAGE_FETCH_BATCH_SIZE, before: lastMessageId });
      } else {
        messages = await textChannel.messages.fetch({ limit: MESSAGE_FETCH_BATCH_SIZE });
      }
      
      if (messages.size === 0) {
        break;
      }

      totalMessages += messages.size;
      
      // Process each message
      for (const [, message] of messages) {
        // Skip bot messages
        if (message.author.bot) {
          continue;
        }

        const urls = extractUrls(message.content);
        
        for (const url of urls) {
          const domain = extractDomain(url);
          const discordLink: DiscordLink = {
            message_id: message.id,
            channel_id: message.channelId,
            channel_name: channelName,
            author_id: message.author.id,
            author_name: message.author.tag,
            timestamp: message.createdAt.toISOString(),
            message_content: message.content.substring(0, MAX_MESSAGE_CONTENT_LENGTH),
            url: url,
            domain: domain
          };
          
          allLinks.push(discordLink);
          totalLinks++;
        }
      }

      // Update progress every batch
      await interaction.editReply(
        `⏳ Processing... ${totalMessages} messages scanned, ${totalLinks} links found...`
      );

      // Get the last message ID for pagination
      lastMessageId = messages.last()?.id;

      // Add a small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    }

    // Save all links in batches
    if (allLinks.length > 0) {
      console.log(`[INFO] Saving ${allLinks.length} links in batches...`);
      
      for (let i = 0; i < allLinks.length; i += LINK_SAVE_BATCH_SIZE) {
        const batch = allLinks.slice(i, i + LINK_SAVE_BATCH_SIZE);
        const { error } = await saveDiscordLinks(batch);
        
        if (error) {
          console.error(`[ERROR] Failed to save batch ${i}-${i + batch.length}:`, error);
          await interaction.editReply(
            `⚠️ Completed with errors. Processed ${totalMessages} messages, found ${totalLinks} links. Some links may not have been saved.`
          );
          return;
        }
        
        // Update progress during save
        await interaction.editReply(
          `💾 Saving links... ${Math.min(i + LINK_SAVE_BATCH_SIZE, allLinks.length)}/${allLinks.length} saved...`
        );
      }

      console.log(`[INFO] Successfully saved ${allLinks.length} links`);
      await interaction.editReply(
        `✅ Completed! Processed ${totalMessages} messages and saved ${totalLinks} links from channel history.`
      );
    } else {
      await interaction.editReply(
        `✅ Completed! Processed ${totalMessages} messages but found no links.`
      );
    }

  } catch (error) {
    console.error('[ERROR] Failed to ingest channel history:', error);
    await interaction.editReply('❌ An error occurred while processing channel history. Please try again.');
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
    } else if (commandName === 'ingest-all') {
      await handleIngestAllCommand(interaction);
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
