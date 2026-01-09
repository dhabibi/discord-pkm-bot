import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required Supabase environment variables: SUPABASE_URL and/or SUPABASE_SECRET_KEY');
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }

  return supabaseClient;
}

export function resetSupabaseClient(): void {
  supabaseClient = null;
}

export interface Link {
  url: string;
  created_at?: string;
}

export interface DiscordLink {
  id?: string;
  message_id: string;
  channel_id: string;
  channel_name: string;
  author_id: string;
  author_name: string;
  timestamp: string;
  message_content: string;
  url: string;
  domain: string;
  created_at?: string;
}

export async function saveLink(url: string): Promise<{ data: Link | null; error: any }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('links')
      .insert({ url })
      .select()
      .single();
    
    return { data, error };
  } catch (error) {
    // Handle errors from .single() or other operations
    console.error('[ERROR] Exception in saveLink:', error);
    return { data: null, error };
  }
}

export async function saveDiscordLinks(links: DiscordLink[]): Promise<{ data: DiscordLink[] | null; error: any }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('discord_links')
      .upsert(links, { onConflict: 'message_id,url' })
      .select();
    
    return { data, error };
  } catch (error) {
    console.error('[ERROR] Exception in saveDiscordLinks:', error);
    return { data: null, error };
  }
}
