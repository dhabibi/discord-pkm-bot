import { Message } from 'discord.js';
import { MCPMessage } from './types';
import { getPokeClient } from './pokeClient';

/**
 * Convert Discord message to MCP format
 */
export function discordToMCPMessage(message: Message): MCPMessage {
  return {
    id: message.id,
    type: message.attachments.size > 0 ? 'media' : 'text',
    content: message.content,
    timestamp: message.createdAt.toISOString(),
    sender: {
      id: message.author.id,
      name: message.author.username,
      platform: 'discord'
    },
    context: {
      channelId: message.channelId,
      threadId: message.channel.isThread() ? message.channel.id : undefined,
      replyToId: message.reference?.messageId
    },
    metadata: {
      attachments: message.attachments.map(att => ({
        url: att.url,
        name: att.name,
        contentType: att.contentType
      })),
      embeds: message.embeds.length,
      mentions: message.mentions.users.size
    }
  };
}

/**
 * Forward a Discord message to Poke
 */
export async function forwardDiscordMessageToPoke(message: Message): Promise<boolean> {
  try {
    const mcpMessage = discordToMCPMessage(message);
    const pokeClient = getPokeClient();
    
    const response = await pokeClient.sendMessage(mcpMessage);
    
    if (response.success) {
      console.log(`[INFO] Forwarded Discord message ${message.id} to Poke`);
      return true;
    } else {
      console.error(`[ERROR] Failed to forward message to Poke: ${response.error}`);
      return false;
    }
  } catch (error) {
    console.error('[ERROR] Exception while forwarding message to Poke:', error);
    return false;
  }
}

/**
 * Check if a message should be forwarded to Poke
 */
export function shouldForwardToPoke(message: Message): boolean {
  // Don't forward bot messages
  if (message.author.bot) {
    return false;
  }

  // Don't forward system messages
  if (message.system) {
    return false;
  }

  // Don't forward empty messages
  if (!message.content && message.attachments.size === 0) {
    return false;
  }

  return true;
}
