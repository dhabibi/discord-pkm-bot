-- Migration 005: Audit Logging Triggers
-- Description: Creates a comprehensive audit logging system to track all
--              data changes across critical tables for compliance and debugging.
--
-- Tables created:
--   - audit_log: Central audit log table
--
-- Features:
--   - Automatic tracking of INSERT, UPDATE, DELETE operations
--   - Before/after snapshots for UPDATE operations
--   - User tracking from JWT claims
--   - Configurable per-table auditing

-- ============================================================================
-- Table: audit_log
-- Description: Central audit log for tracking all data changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Operation metadata
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
    table_name TEXT NOT NULL,
    schema_name TEXT NOT NULL DEFAULT 'public',

    -- Record identification
    record_id TEXT,  -- Primary key of affected record (as text for flexibility)

    -- Change data
    old_data JSONB,  -- Previous state (for UPDATE/DELETE)
    new_data JSONB,  -- New state (for INSERT/UPDATE)
    changed_fields TEXT[],  -- List of fields that changed (for UPDATE)

    -- User context
    user_id TEXT,  -- From JWT claims
    session_id TEXT,  -- From JWT claims or application
    ip_address INET,  -- Client IP if available

    -- Application context
    application_name TEXT,
    client_info JSONB DEFAULT '{}',

    -- Temporal
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Transaction tracking
    transaction_id BIGINT DEFAULT txid_current()
);

-- ============================================================================
-- Audit Trigger Function
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    audit_record_id TEXT;
    old_data_json JSONB;
    new_data_json JSONB;
    changed_cols TEXT[];
    current_user_id TEXT;
    current_session_id TEXT;
    col_name TEXT;
BEGIN
    -- Get user context from JWT claims (will be NULL if not authenticated)
    BEGIN
        current_user_id := current_setting('request.jwt.claim.user_id', true);
        current_session_id := current_setting('request.jwt.claim.session_id', true);
    EXCEPTION WHEN OTHERS THEN
        current_user_id := NULL;
        current_session_id := NULL;
    END;

    -- Determine record ID (try common primary key columns)
    IF TG_OP = 'DELETE' THEN
        -- Try to get ID from old record
        IF OLD.id IS NOT NULL THEN
            audit_record_id := OLD.id::TEXT;
        ELSE
            audit_record_id := NULL;
        END IF;
        old_data_json := to_jsonb(OLD);
        new_data_json := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        IF NEW.id IS NOT NULL THEN
            audit_record_id := NEW.id::TEXT;
        ELSE
            audit_record_id := NULL;
        END IF;
        old_data_json := NULL;
        new_data_json := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.id IS NOT NULL THEN
            audit_record_id := NEW.id::TEXT;
        ELSE
            audit_record_id := NULL;
        END IF;
        old_data_json := to_jsonb(OLD);
        new_data_json := to_jsonb(NEW);

        -- Calculate changed fields
        changed_cols := ARRAY[]::TEXT[];
        FOR col_name IN SELECT key FROM jsonb_each(new_data_json)
        LOOP
            IF old_data_json->col_name IS DISTINCT FROM new_data_json->col_name THEN
                changed_cols := array_append(changed_cols, col_name);
            END IF;
        END LOOP;
    END IF;

    -- Skip if no actual changes on UPDATE
    IF TG_OP = 'UPDATE' AND array_length(changed_cols, 1) IS NULL THEN
        RETURN NEW;
    END IF;

    -- Insert audit record
    INSERT INTO audit_log (
        operation,
        table_name,
        schema_name,
        record_id,
        old_data,
        new_data,
        changed_fields,
        user_id,
        session_id,
        application_name,
        ip_address
    ) VALUES (
        TG_OP,
        TG_TABLE_NAME,
        TG_TABLE_SCHEMA,
        audit_record_id,
        old_data_json,
        new_data_json,
        changed_cols,
        current_user_id,
        current_session_id,
        current_setting('application_name', true),
        inet_client_addr()
    );

    -- Return appropriate value
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Apply Audit Triggers to Tables
-- ============================================================================

-- RLM Memories (track all changes)
DROP TRIGGER IF EXISTS audit_rlm_memories ON rlm_memories;
CREATE TRIGGER audit_rlm_memories
    AFTER INSERT OR UPDATE OR DELETE ON rlm_memories
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

-- RLM Memory Relations (track all changes)
DROP TRIGGER IF EXISTS audit_rlm_memory_relations ON rlm_memory_relations;
CREATE TRIGGER audit_rlm_memory_relations
    AFTER INSERT OR UPDATE OR DELETE ON rlm_memory_relations
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

-- Agent Sessions (track status changes)
DROP TRIGGER IF EXISTS audit_agent_sessions ON agent_sessions;
CREATE TRIGGER audit_agent_sessions
    AFTER INSERT OR UPDATE OR DELETE ON agent_sessions
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

-- Agent Tasks (track all changes for debugging)
DROP TRIGGER IF EXISTS audit_agent_tasks ON agent_tasks;
CREATE TRIGGER audit_agent_tasks
    AFTER INSERT OR UPDATE OR DELETE ON agent_tasks
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

-- Discord Links (track changes)
DROP TRIGGER IF EXISTS audit_discord_links ON discord_links;
CREATE TRIGGER audit_discord_links
    AFTER INSERT OR UPDATE OR DELETE ON discord_links
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

-- Discord Channels (track configuration changes)
DROP TRIGGER IF EXISTS audit_discord_channels ON discord_channels;
CREATE TRIGGER audit_discord_channels
    AFTER INSERT OR UPDATE OR DELETE ON discord_channels
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

-- Discord Guilds (track configuration changes)
DROP TRIGGER IF EXISTS audit_discord_guilds ON discord_guilds;
CREATE TRIGGER audit_discord_guilds
    AFTER INSERT OR UPDATE OR DELETE ON discord_guilds
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

-- NOTE: We do NOT audit rlm_contexts, agent_results, or agent_logs
-- as these are high-volume tables where auditing would be excessive

-- ============================================================================
-- Indexes for Audit Log
-- ============================================================================

-- Primary query patterns
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_session_id ON audit_log(session_id);

-- BRIN for time-series queries (audit logs are append-only)
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at_brin
    ON audit_log
    USING brin (created_at)
    WITH (pages_per_range = 128);

-- Composite index for table+time queries
CREATE INDEX IF NOT EXISTS idx_audit_log_table_created
    ON audit_log(table_name, created_at DESC);

-- Transaction tracking
CREATE INDEX IF NOT EXISTS idx_audit_log_transaction_id ON audit_log(transaction_id);

-- GIN for JSON data queries
CREATE INDEX IF NOT EXISTS idx_audit_log_old_data_gin
    ON audit_log
    USING gin (old_data jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_audit_log_new_data_gin
    ON audit_log
    USING gin (new_data jsonb_path_ops);

-- GIN for changed fields array
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_fields_gin
    ON audit_log
    USING gin (changed_fields);

-- ============================================================================
-- Audit Log Retention Function
-- Description: Can be called periodically to clean up old audit logs
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_log
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Helper Views for Audit Analysis
-- ============================================================================

-- Recent audit activity summary
CREATE OR REPLACE VIEW audit_recent_activity AS
SELECT
    date_trunc('hour', created_at) AS hour,
    table_name,
    operation,
    COUNT(*) AS operation_count
FROM audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY date_trunc('hour', created_at), table_name, operation
ORDER BY hour DESC, table_name, operation;

-- User activity summary
CREATE OR REPLACE VIEW audit_user_activity AS
SELECT
    user_id,
    table_name,
    operation,
    COUNT(*) AS operation_count,
    MAX(created_at) AS last_activity
FROM audit_log
WHERE user_id IS NOT NULL
GROUP BY user_id, table_name, operation
ORDER BY last_activity DESC;

-- ============================================================================
-- RLS for Audit Log (service role only)
-- ============================================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only service role can access audit logs
CREATE POLICY audit_log_service_only ON audit_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON audit_log TO service_role;
GRANT SELECT ON audit_recent_activity TO service_role;
GRANT SELECT ON audit_user_activity TO service_role;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE audit_log IS 'Central audit log tracking all data changes across critical tables';
COMMENT ON FUNCTION audit_trigger_function IS 'Generic audit trigger that logs INSERT/UPDATE/DELETE operations';
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Removes audit log entries older than specified retention period';

COMMENT ON COLUMN audit_log.old_data IS 'Previous state of the record (for UPDATE/DELETE)';
COMMENT ON COLUMN audit_log.new_data IS 'New state of the record (for INSERT/UPDATE)';
COMMENT ON COLUMN audit_log.changed_fields IS 'List of field names that changed (for UPDATE)';
COMMENT ON COLUMN audit_log.transaction_id IS 'PostgreSQL transaction ID for correlation';

COMMENT ON VIEW audit_recent_activity IS 'Hourly summary of audit activity over last 24 hours';
COMMENT ON VIEW audit_user_activity IS 'Per-user audit activity summary';
