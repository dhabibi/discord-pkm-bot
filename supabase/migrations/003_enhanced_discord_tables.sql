-- Migration 003: Enhanced Discord Tables with Full-Text Search
-- Description: Extends the existing discord_links table with RLM-py integration,
--              adds full-text search capabilities, and creates supporting tables
--              for Discord-specific functionality.
--
-- Changes:
--   - ALTER discord_links: Add embedding, fts vectors, and RLM integration columns
--   - CREATE discord_channels: Channel metadata and settings
--   - CREATE discord_guilds: Guild/server configuration
--   - Full-text search indexes and triggers

-- ============================================================================
-- Extend discord_links table with RLM-py integration fields
-- ============================================================================

-- Add vector embedding column for semantic search
ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add full-text search vector column
ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS fts_vector tsvector;

-- Add RLM memory integration
ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS memory_id UUID REFERENCES rlm_memories(id) ON DELETE SET NULL;

-- Add processing status for async embedding generation
ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending'
        CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed', 'skipped'));

ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS embedding_error TEXT;

ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS embedding_model TEXT;

-- Add content enrichment fields
ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS page_title TEXT;

ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS page_description TEXT;

ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS page_image_url TEXT;

ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS content_type TEXT;  -- e.g., 'article', 'video', 'image', 'repository'

-- Add categorization
ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS auto_category TEXT;

-- Add quality/relevance scoring
ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS relevance_score FLOAT DEFAULT 0.5
        CHECK (relevance_score >= 0 AND relevance_score <= 1);

-- Add access tracking
ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE;

-- Add update tracking
ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add guild_id for multi-server support
ALTER TABLE discord_links
    ADD COLUMN IF NOT EXISTS guild_id TEXT;

-- ============================================================================
-- Table: discord_channels
-- Description: Channel metadata and settings for the bot
-- ============================================================================
CREATE TABLE IF NOT EXISTS discord_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Discord identifiers
    channel_id TEXT NOT NULL UNIQUE,
    guild_id TEXT NOT NULL,
    channel_name TEXT NOT NULL,

    -- Channel type (text, voice, thread, etc.)
    channel_type TEXT DEFAULT 'text',

    -- Bot settings for this channel
    autosave_enabled BOOLEAN DEFAULT false,
    autosave_domains TEXT[] DEFAULT '{}',  -- Empty = all domains, otherwise whitelist
    excluded_domains TEXT[] DEFAULT '{}',  -- Blacklist specific domains

    -- Ingestion tracking
    last_ingested_at TIMESTAMP WITH TIME ZONE,
    last_ingested_message_id TEXT,
    total_links_ingested INTEGER DEFAULT 0,

    -- Channel statistics
    link_count INTEGER DEFAULT 0,
    unique_domains_count INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- Table: discord_guilds
-- Description: Guild/server configuration and metadata
-- ============================================================================
CREATE TABLE IF NOT EXISTS discord_guilds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Discord identifiers
    guild_id TEXT NOT NULL UNIQUE,
    guild_name TEXT NOT NULL,

    -- Bot configuration
    bot_enabled BOOLEAN DEFAULT true,
    default_autosave BOOLEAN DEFAULT false,
    allowed_channels TEXT[] DEFAULT '{}',  -- Empty = all channels allowed

    -- Feature flags
    embedding_enabled BOOLEAN DEFAULT true,
    link_enrichment_enabled BOOLEAN DEFAULT true,
    agent_tasks_enabled BOOLEAN DEFAULT false,

    -- Limits
    max_links_per_day INTEGER DEFAULT 1000,
    max_channels INTEGER DEFAULT 50,

    -- Usage tracking
    total_links INTEGER DEFAULT 0,
    total_embeddings INTEGER DEFAULT 0,
    links_today INTEGER DEFAULT 0,
    links_today_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Metadata
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- Full-Text Search Configuration
-- ============================================================================

-- Create function to generate FTS vector from discord_links
CREATE OR REPLACE FUNCTION discord_links_fts_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fts_vector := setweight(to_tsvector('english', COALESCE(NEW.page_title, '')), 'A') ||
                      setweight(to_tsvector('english', COALESCE(NEW.page_description, '')), 'B') ||
                      setweight(to_tsvector('english', COALESCE(NEW.message_content, '')), 'C') ||
                      setweight(to_tsvector('english', COALESCE(NEW.domain, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update FTS vector
DROP TRIGGER IF EXISTS discord_links_fts_update ON discord_links;
CREATE TRIGGER discord_links_fts_update
    BEFORE INSERT OR UPDATE OF page_title, page_description, message_content, domain
    ON discord_links
    FOR EACH ROW
    EXECUTE FUNCTION discord_links_fts_trigger();

-- Backfill existing rows with FTS vectors
UPDATE discord_links SET fts_vector =
    setweight(to_tsvector('english', COALESCE(page_title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(page_description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(message_content, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(domain, '')), 'D')
WHERE fts_vector IS NULL;

-- ============================================================================
-- New Indexes for discord_links
-- ============================================================================

-- HNSW index for semantic search on embeddings
CREATE INDEX IF NOT EXISTS idx_discord_links_embedding_hnsw
    ON discord_links
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_discord_links_fts_gin
    ON discord_links
    USING gin (fts_vector);

-- GIN index for tags array search
CREATE INDEX IF NOT EXISTS idx_discord_links_tags_gin
    ON discord_links
    USING gin (tags);

-- Index for embedding status (processing queue)
CREATE INDEX IF NOT EXISTS idx_discord_links_embedding_status
    ON discord_links(embedding_status)
    WHERE embedding_status IN ('pending', 'processing', 'failed');

-- Index for memory integration
CREATE INDEX IF NOT EXISTS idx_discord_links_memory_id
    ON discord_links(memory_id);

-- Index for guild filtering
CREATE INDEX IF NOT EXISTS idx_discord_links_guild_id
    ON discord_links(guild_id);

-- Composite index for channel+guild queries
CREATE INDEX IF NOT EXISTS idx_discord_links_guild_channel
    ON discord_links(guild_id, channel_id);

-- Index for content type filtering
CREATE INDEX IF NOT EXISTS idx_discord_links_content_type
    ON discord_links(content_type);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_discord_links_auto_category
    ON discord_links(auto_category);

-- Index for relevance sorting
CREATE INDEX IF NOT EXISTS idx_discord_links_relevance
    ON discord_links(relevance_score DESC);

-- ============================================================================
-- Indexes for discord_channels
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_discord_channels_guild_id
    ON discord_channels(guild_id);

CREATE INDEX IF NOT EXISTS idx_discord_channels_autosave
    ON discord_channels(autosave_enabled)
    WHERE autosave_enabled = true;

-- GIN for domain arrays
CREATE INDEX IF NOT EXISTS idx_discord_channels_autosave_domains_gin
    ON discord_channels
    USING gin (autosave_domains);

-- ============================================================================
-- Indexes for discord_guilds
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_discord_guilds_bot_enabled
    ON discord_guilds(bot_enabled)
    WHERE bot_enabled = true;

-- GIN for allowed channels array
CREATE INDEX IF NOT EXISTS idx_discord_guilds_allowed_channels_gin
    ON discord_guilds
    USING gin (allowed_channels);

-- ============================================================================
-- Update Trigger for updated_at columns
-- ============================================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to discord_links
DROP TRIGGER IF EXISTS discord_links_updated_at ON discord_links;
CREATE TRIGGER discord_links_updated_at
    BEFORE UPDATE ON discord_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to discord_channels
DROP TRIGGER IF EXISTS discord_channels_updated_at ON discord_channels;
CREATE TRIGGER discord_channels_updated_at
    BEFORE UPDATE ON discord_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to discord_guilds
DROP TRIGGER IF EXISTS discord_guilds_updated_at ON discord_guilds;
CREATE TRIGGER discord_guilds_updated_at
    BEFORE UPDATE ON discord_guilds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Table Comments
-- ============================================================================
COMMENT ON TABLE discord_channels IS 'Channel metadata and bot settings per Discord channel';
COMMENT ON TABLE discord_guilds IS 'Guild/server configuration and usage tracking';

COMMENT ON COLUMN discord_links.embedding IS 'Vector embedding (1536d) for semantic similarity search';
COMMENT ON COLUMN discord_links.fts_vector IS 'Full-text search vector combining title, description, content, and domain';
COMMENT ON COLUMN discord_links.memory_id IS 'Reference to RLM memory created from this link';
COMMENT ON COLUMN discord_links.embedding_status IS 'Status of async embedding generation';
COMMENT ON COLUMN discord_links.relevance_score IS 'Computed relevance/quality score (0-1)';

COMMENT ON COLUMN discord_channels.autosave_domains IS 'Domain whitelist for autosave (empty = all allowed)';
COMMENT ON COLUMN discord_channels.excluded_domains IS 'Domain blacklist for autosave';

COMMENT ON COLUMN discord_guilds.allowed_channels IS 'Channel whitelist (empty = all allowed)';
COMMENT ON COLUMN discord_guilds.links_today IS 'Rate limiting counter, reset daily';
