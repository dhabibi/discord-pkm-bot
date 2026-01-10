-- Migration 004: Row Level Security (RLS) Policies
-- Description: Implements RLS policies for all tables to ensure proper access control.
--              This migration sets up security boundaries based on guild_id and user context.
--
-- Security Model:
--   - Service role (backend): Full access for server-side operations
--   - Authenticated users: Access scoped by guild membership (via JWT claims)
--   - Anonymous: No access
--
-- JWT Claims Expected:
--   - user_id: Discord user ID
--   - guild_ids: Array of guild IDs the user belongs to
--   - role: 'service_role' | 'authenticated' | 'anon'

-- ============================================================================
-- Helper Functions for RLS
-- ============================================================================

-- Function to check if current user has access to a guild
CREATE OR REPLACE FUNCTION auth.user_has_guild_access(check_guild_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Service role always has access
    IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        RETURN true;
    END IF;

    -- Check if guild_id is in user's guild_ids array from JWT
    RETURN check_guild_id = ANY(
        string_to_array(
            current_setting('request.jwt.claim.guild_ids', true),
            ','
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's ID from JWT
CREATE OR REPLACE FUNCTION auth.current_user_id()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('request.jwt.claim.user_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current request is from service role
CREATE OR REPLACE FUNCTION auth.is_service_role()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_setting('request.jwt.claim.role', true) = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================

-- Core RLM tables
ALTER TABLE rlm_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rlm_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rlm_memory_relations ENABLE ROW LEVEL SECURITY;

-- Agent tables
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Discord tables
ALTER TABLE discord_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_guilds ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for rlm_memories
-- ============================================================================

-- Service role: Full access
CREATE POLICY rlm_memories_service_all ON rlm_memories
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users: Read access to all non-deleted memories
-- (memories are shared across all users as knowledge base)
CREATE POLICY rlm_memories_auth_select ON rlm_memories
    FOR SELECT
    TO authenticated
    USING (deleted_at IS NULL);

-- Authenticated users: Insert their own memories
CREATE POLICY rlm_memories_auth_insert ON rlm_memories
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Authenticated users: Update only memories they created via source tracking
-- (source_id should match their user_id for manual entries)
CREATE POLICY rlm_memories_auth_update ON rlm_memories
    FOR UPDATE
    TO authenticated
    USING (source_type = 'manual' AND source_id = auth.current_user_id())
    WITH CHECK (source_type = 'manual' AND source_id = auth.current_user_id());

-- ============================================================================
-- RLS Policies for rlm_contexts
-- ============================================================================

-- Service role: Full access
CREATE POLICY rlm_contexts_service_all ON rlm_contexts
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users: Read their own contexts
CREATE POLICY rlm_contexts_auth_select ON rlm_contexts
    FOR SELECT
    TO authenticated
    USING (user_id = auth.current_user_id() OR user_id IS NULL);

-- Authenticated users: Create contexts
CREATE POLICY rlm_contexts_auth_insert ON rlm_contexts
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.current_user_id() OR user_id IS NULL);

-- Authenticated users: Delete their own contexts
CREATE POLICY rlm_contexts_auth_delete ON rlm_contexts
    FOR DELETE
    TO authenticated
    USING (user_id = auth.current_user_id());

-- ============================================================================
-- RLS Policies for rlm_memory_relations
-- ============================================================================

-- Service role: Full access
CREATE POLICY rlm_memory_relations_service_all ON rlm_memory_relations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users: Read all relations (knowledge graph is shared)
CREATE POLICY rlm_memory_relations_auth_select ON rlm_memory_relations
    FOR SELECT
    TO authenticated
    USING (true);

-- Authenticated users: Create relations
CREATE POLICY rlm_memory_relations_auth_insert ON rlm_memory_relations
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================================================
-- RLS Policies for agent_sessions
-- ============================================================================

-- Service role: Full access
CREATE POLICY agent_sessions_service_all ON agent_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users: Read sessions from their guilds
CREATE POLICY agent_sessions_auth_select ON agent_sessions
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.current_user_id()
        OR auth.user_has_guild_access(guild_id)
    );

-- Authenticated users: Create sessions in their guilds
CREATE POLICY agent_sessions_auth_insert ON agent_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.current_user_id()
        OR auth.user_has_guild_access(guild_id)
    );

-- Authenticated users: Update their own sessions
CREATE POLICY agent_sessions_auth_update ON agent_sessions
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.current_user_id())
    WITH CHECK (user_id = auth.current_user_id());

-- ============================================================================
-- RLS Policies for agent_tasks
-- ============================================================================

-- Service role: Full access
CREATE POLICY agent_tasks_service_all ON agent_tasks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users: Read tasks from their sessions
CREATE POLICY agent_tasks_auth_select ON agent_tasks
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM agent_sessions s
            WHERE s.id = agent_tasks.session_id
            AND (s.user_id = auth.current_user_id() OR auth.user_has_guild_access(s.guild_id))
        )
    );

-- Authenticated users: Create tasks in their sessions
CREATE POLICY agent_tasks_auth_insert ON agent_tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM agent_sessions s
            WHERE s.id = agent_tasks.session_id
            AND (s.user_id = auth.current_user_id() OR auth.user_has_guild_access(s.guild_id))
        )
    );

-- Authenticated users: Update tasks in their sessions (e.g., cancel)
CREATE POLICY agent_tasks_auth_update ON agent_tasks
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM agent_sessions s
            WHERE s.id = agent_tasks.session_id
            AND s.user_id = auth.current_user_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM agent_sessions s
            WHERE s.id = agent_tasks.session_id
            AND s.user_id = auth.current_user_id()
        )
    );

-- ============================================================================
-- RLS Policies for agent_results
-- ============================================================================

-- Service role: Full access
CREATE POLICY agent_results_service_all ON agent_results
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users: Read results from tasks they can access
CREATE POLICY agent_results_auth_select ON agent_results
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM agent_tasks t
            JOIN agent_sessions s ON s.id = t.session_id
            WHERE t.id = agent_results.task_id
            AND (s.user_id = auth.current_user_id() OR auth.user_has_guild_access(s.guild_id))
        )
    );

-- ============================================================================
-- RLS Policies for agent_logs
-- ============================================================================

-- Service role: Full access
CREATE POLICY agent_logs_service_all ON agent_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users: Read logs from their sessions
CREATE POLICY agent_logs_auth_select ON agent_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM agent_sessions s
            WHERE s.id = agent_logs.session_id
            AND (s.user_id = auth.current_user_id() OR auth.user_has_guild_access(s.guild_id))
        )
    );

-- ============================================================================
-- RLS Policies for discord_links
-- ============================================================================

-- Service role: Full access
CREATE POLICY discord_links_service_all ON discord_links
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users: Read links from their guilds
CREATE POLICY discord_links_auth_select ON discord_links
    FOR SELECT
    TO authenticated
    USING (
        guild_id IS NULL  -- Legacy links without guild_id
        OR auth.user_has_guild_access(guild_id)
    );

-- Authenticated users: Insert links in their guilds
CREATE POLICY discord_links_auth_insert ON discord_links
    FOR INSERT
    TO authenticated
    WITH CHECK (
        guild_id IS NULL
        OR auth.user_has_guild_access(guild_id)
    );

-- Authenticated users: Update links in their guilds (e.g., add tags)
CREATE POLICY discord_links_auth_update ON discord_links
    FOR UPDATE
    TO authenticated
    USING (
        guild_id IS NULL
        OR auth.user_has_guild_access(guild_id)
    )
    WITH CHECK (
        guild_id IS NULL
        OR auth.user_has_guild_access(guild_id)
    );

-- ============================================================================
-- RLS Policies for discord_channels
-- ============================================================================

-- Service role: Full access
CREATE POLICY discord_channels_service_all ON discord_channels
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users: Read channels from their guilds
CREATE POLICY discord_channels_auth_select ON discord_channels
    FOR SELECT
    TO authenticated
    USING (auth.user_has_guild_access(guild_id));

-- Authenticated users: Update channel settings in their guilds
CREATE POLICY discord_channels_auth_update ON discord_channels
    FOR UPDATE
    TO authenticated
    USING (auth.user_has_guild_access(guild_id))
    WITH CHECK (auth.user_has_guild_access(guild_id));

-- ============================================================================
-- RLS Policies for discord_guilds
-- ============================================================================

-- Service role: Full access
CREATE POLICY discord_guilds_service_all ON discord_guilds
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users: Read their guild configurations
CREATE POLICY discord_guilds_auth_select ON discord_guilds
    FOR SELECT
    TO authenticated
    USING (auth.user_has_guild_access(guild_id));

-- Authenticated users: Update their guild settings (admin users would need additional checks)
CREATE POLICY discord_guilds_auth_update ON discord_guilds
    FOR UPDATE
    TO authenticated
    USING (auth.user_has_guild_access(guild_id))
    WITH CHECK (auth.user_has_guild_access(guild_id));

-- ============================================================================
-- Grant permissions to roles
-- ============================================================================

-- Service role gets full access (already default in Supabase)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Authenticated role gets usage
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Anon role gets nothing (policies will deny anyway)
GRANT USAGE ON SCHEMA public TO anon;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION auth.user_has_guild_access IS 'Checks if current JWT user has access to specified guild';
COMMENT ON FUNCTION auth.current_user_id IS 'Returns user_id from current JWT claims';
COMMENT ON FUNCTION auth.is_service_role IS 'Returns true if current request is from service role';
