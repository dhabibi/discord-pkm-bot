import { Message } from 'discord.js';
import { isAutosaveEnabled } from './autosave';
import { saveLink } from './supabase';
import { extractUrls } from './urlExtractor';

export async function handleMessage(message: Message): Promise<void> {
  // Ignore messages from bots
  if (message.author.bot) {
    return;
  }

  // Check if autosave is enabled for this channel
  if (!isAutosaveEnabled(message.channelId)) {
    return;
  }

  // Extract URLs from message
  const urls = extractUrls(message.content);

  // Save each URL
  for (const url of urls) {
    try {
      const { error } = await saveLink(url);
      if (error) {
        console.error(`[ERROR] Failed to autosave URL ${url}:`, error);
      } else {
        console.log(`[INFO] Autosaved URL: ${url} from channel ${message.channelId}`);
      }
    } catch (error) {
      console.error(`[ERROR] Exception while autosaving URL ${url}:`, error);
    }
  }
}
