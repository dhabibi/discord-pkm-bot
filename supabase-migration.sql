-- Create the discord_links table for storing links extracted from Discord messages
-- This table includes rich metadata about each link's context

CREATE TABLE IF NOT EXISTS discord_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  message_content TEXT,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_discord_links_channel_id ON discord_links(channel_id);
CREATE INDEX IF NOT EXISTS idx_discord_links_author_id ON discord_links(author_id);
CREATE INDEX IF NOT EXISTS idx_discord_links_domain ON discord_links(domain);
CREATE INDEX IF NOT EXISTS idx_discord_links_timestamp ON discord_links(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_discord_links_url ON discord_links(url);

-- Add a comment to the table
COMMENT ON TABLE discord_links IS 'Stores links extracted from Discord channel history with full context metadata';
