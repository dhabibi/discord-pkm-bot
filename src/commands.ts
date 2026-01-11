import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, NewsChannel, ThreadChannel, Collection, Message, PermissionFlagsBits } from 'discord.js';
import { saveLink, saveDiscordLinks, DiscordLink } from './supabase';
import { toggleAutosave, isAutosaveEnabled } from './autosave';
import { extractUrls, extractDomain } from './urlExtractor';
import { isAuthorized, logUnauthorizedAccess, getUnauthorizedMessage } from './authorization';

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

  // Check if user has ReadMessageHistory permission
  const member = interaction.member;
  if (member && 'permissions' in member && member.permissions && typeof member.permissions !== 'string') {
    if (!member.permissions.has(PermissionFlagsBits.ReadMessageHistory)) {
      await interaction.reply('❌ You need the "Read Message History" permission to use this command.');
      return;
    }
  }

  // Defer reply since this operation will take time
  await interaction.deferReply();

  try {
    const channelName = ('name' in textChannel && textChannel.name) ? textChannel.name : 'Unknown Channel';
    let totalMessages = 0;
    let totalLinks = 0;
    let linksBatch: DiscordLink[] = [];
    
    // Configuration constants
    const MESSAGE_FETCH_BATCH_SIZE = 100; // Discord.js recommended batch size
    const LINK_SAVE_BATCH_SIZE = 50; // Supabase batch insert size
    const MAX_MESSAGE_CONTENT_LENGTH = 500; // Truncate message content to this length
    const RATE_LIMIT_DELAY_MS = 1000; // Delay between batches to respect rate limits
    
    let lastMessageId: string | undefined = undefined;

    console.log(`[INFO] Starting ingest-all for channel ${textChannel.id} (${channelName})`);

    // Helper function to save a batch of links
    const saveBatch = async (links: DiscordLink[]): Promise<boolean> => {
      if (links.length === 0) return true;
      
      const { error } = await saveDiscordLinks(links);
      
      if (error) {
        console.error(`[ERROR] Failed to save batch:`, error);
        return false;
      }
      
      return true;
    };

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
            author_name: message.author.username,
            timestamp: message.createdAt.toISOString(),
            message_content: message.content.substring(0, MAX_MESSAGE_CONTENT_LENGTH),
            url: url,
            domain: domain
          };
          
          linksBatch.push(discordLink);
          totalLinks++;
          
          // Save batch when it reaches the limit to avoid memory issues
          if (linksBatch.length >= LINK_SAVE_BATCH_SIZE) {
            const success = await saveBatch(linksBatch);
            if (!success) {
              await interaction.editReply(
                `⚠️ Completed with errors. Processed ${totalMessages} messages, found ${totalLinks} links. Some links may not have been saved.`
              );
              return;
            }
            
            await interaction.editReply(
              `💾 Saving... ${totalMessages} messages scanned, ${totalLinks} links saved...`
            );
            
            linksBatch = []; // Clear the batch
          }
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

    // Save any remaining links in the batch
    if (linksBatch.length > 0) {
      console.log(`[INFO] Saving final batch of ${linksBatch.length} links...`);
      const success = await saveBatch(linksBatch);
      
      if (!success) {
        await interaction.editReply(
          `⚠️ Completed with errors. Processed ${totalMessages} messages, found ${totalLinks} links. Some links may not have been saved.`
        );
        return;
      }
    }

    console.log(`[INFO] Successfully saved ${totalLinks} links`);
    
    if (totalLinks > 0) {
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
  const userId = interaction.user.id;
  const username = interaction.user.username;
  
  console.log(`[INFO] Command received: /${commandName} by ${username}`);

  // Authorization check
  if (!isAuthorized(userId)) {
    logUnauthorizedAccess(userId, username, commandName);
    try {
      await interaction.reply({ content: getUnauthorizedMessage(), ephemeral: true });
    } catch (error) {
      console.error(`[ERROR] Failed to send unauthorized message to user:`, error);
    }
    return;
  }

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
