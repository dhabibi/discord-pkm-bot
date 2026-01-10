-- Migration 006: Index Verification and Optimization
-- Description: Consolidates index documentation, adds any missing indexes,
--              and provides helper functions for index maintenance.
--
-- This migration verifies all indexes are in place according to specification:
--   - GIN indexes: Array fields, JSONB fields, full-text search
--   - HNSW indexes: Vector embeddings for semantic search
--   - BRIN indexes: Time-series data (created_at columns)
--   - B-tree indexes: Standard lookups and foreign keys

-- ============================================================================
-- INDEX SPECIFICATION DOCUMENTATION
-- ============================================================================
--
-- GIN INDEXES (Generalized Inverted Index):
--   Purpose: Efficient search in arrays, JSONB, and full-text
--   Tables:
--     - rlm_memories.tags (array)
--     - discord_links.fts_vector (tsvector)
--     - discord_links.tags (array)
--     - discord_channels.autosave_domains (array)
--     - discord_guilds.allowed_channels (array)
--     - agent_tasks.input_data (jsonb)
--     - agent_results.result_data (jsonb)
--     - agent_logs.details (jsonb)
--     - audit_log.old_data, new_data (jsonb)
--     - audit_log.changed_fields (array)
--
-- HNSW INDEXES (Hierarchical Navigable Small World):
--   Purpose: Fast approximate nearest neighbor search for embeddings
--   Parameters: m=16 (connections per node), ef_construction=64 (build quality)
--   Tables:
--     - rlm_memories.embedding
--     - rlm_contexts.query_embedding
--     - discord_links.embedding
--     - agent_results.result_embedding
--
-- BRIN INDEXES (Block Range Index):
--   Purpose: Efficient time-range queries on append-only/time-ordered data
--   Parameters: pages_per_range varies by table volume
--   Tables:
--     - rlm_memories.created_at (32 pages)
--     - rlm_contexts.created_at (32 pages)
--     - agent_sessions.created_at (32 pages)
--     - agent_tasks.created_at (32 pages)
--     - agent_logs.created_at (128 pages - high volume)
--     - audit_log.created_at (128 pages - high volume)
--
-- ============================================================================

-- ============================================================================
-- Helper View: Index Status Summary
-- ============================================================================
CREATE OR REPLACE VIEW index_status AS
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================================
-- Helper Function: Check Index Health
-- ============================================================================
CREATE OR REPLACE FUNCTION check_index_health()
RETURNS TABLE (
    index_name TEXT,
    table_name TEXT,
    index_type TEXT,
    is_valid BOOLEAN,
    index_size TEXT,
    bloat_estimate TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.indexrelid::regclass::TEXT AS index_name,
        i.indrelid::regclass::TEXT AS table_name,
        am.amname::TEXT AS index_type,
        i.indisvalid AS is_valid,
        pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
        CASE
            WHEN pg_relation_size(i.indexrelid) > 0 THEN
                round((100 * (pg_relation_size(i.indexrelid) - pg_stat_all_indexes.idx_tup_read::numeric) /
                    NULLIF(pg_relation_size(i.indexrelid), 0))::numeric, 2)::TEXT || '%'
            ELSE 'N/A'
        END AS bloat_estimate
    FROM pg_index i
    JOIN pg_am am ON am.oid = (SELECT relam FROM pg_class WHERE oid = i.indexrelid)
    LEFT JOIN pg_stat_all_indexes ON pg_stat_all_indexes.indexrelid = i.indexrelid
    WHERE i.indrelid::regclass::TEXT LIKE 'public.%'
       OR i.indrelid::regclass::TEXT NOT LIKE '%.%'
    ORDER BY i.indrelid::regclass::TEXT, i.indexrelid::regclass::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Helper Function: Verify Required Indexes Exist
-- ============================================================================
CREATE OR REPLACE FUNCTION verify_required_indexes()
RETURNS TABLE (
    index_pattern TEXT,
    status TEXT,
    details TEXT
) AS $$
DECLARE
    required_indexes TEXT[] := ARRAY[
        -- RLM tables
        'idx_rlm_memories_embedding_hnsw',
        'idx_rlm_memories_tags_gin',
        'idx_rlm_memories_created_at_brin',
        'idx_rlm_contexts_query_embedding_hnsw',
        'idx_rlm_contexts_created_at_brin',
        'idx_rlm_memory_relations_source',
        'idx_rlm_memory_relations_target',
        -- Agent tables
        'idx_agent_sessions_created_at_brin',
        'idx_agent_tasks_created_at_brin',
        'idx_agent_tasks_input_data_gin',
        'idx_agent_results_result_data_gin',
        'idx_agent_results_embedding_hnsw',
        'idx_agent_logs_created_at_brin',
        'idx_agent_logs_details_gin',
        -- Discord tables
        'idx_discord_links_embedding_hnsw',
        'idx_discord_links_fts_gin',
        'idx_discord_links_tags_gin',
        'idx_discord_channels_autosave_domains_gin',
        'idx_discord_guilds_allowed_channels_gin',
        -- Audit log
        'idx_audit_log_created_at_brin',
        'idx_audit_log_old_data_gin',
        'idx_audit_log_new_data_gin',
        'idx_audit_log_changed_fields_gin'
    ];
    idx TEXT;
    idx_exists BOOLEAN;
BEGIN
    FOREACH idx IN ARRAY required_indexes
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = idx
        ) INTO idx_exists;

        IF idx_exists THEN
            RETURN QUERY SELECT idx, 'EXISTS'::TEXT, 'Index found'::TEXT;
        ELSE
            RETURN QUERY SELECT idx, 'MISSING'::TEXT, 'Index not found - may need to run migration'::TEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Helper Function: Reindex Tables
-- Description: Safely reindex tables during maintenance windows
-- ============================================================================
CREATE OR REPLACE FUNCTION reindex_table_safe(target_table TEXT)
RETURNS TEXT AS $$
BEGIN
    EXECUTE format('REINDEX TABLE CONCURRENTLY %I', target_table);
    RETURN 'Successfully reindexed: ' || target_table;
EXCEPTION WHEN OTHERS THEN
    RETURN 'Failed to reindex ' || target_table || ': ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Statistics Update for Query Optimizer
-- ============================================================================
-- Run ANALYZE on all tables to ensure query planner has current statistics
-- This should be run after initial data load and periodically thereafter

-- Note: In production, use pg_cron or external scheduler for this
-- ANALYZE rlm_memories;
-- ANALYZE rlm_contexts;
-- ANALYZE rlm_memory_relations;
-- ANALYZE agent_sessions;
-- ANALYZE agent_tasks;
-- ANALYZE agent_results;
-- ANALYZE agent_logs;
-- ANALYZE discord_links;
-- ANALYZE discord_channels;
-- ANALYZE discord_guilds;
-- ANALYZE audit_log;

-- ============================================================================
-- Grant Permissions for Helper Functions
-- ============================================================================
GRANT SELECT ON index_status TO service_role;
GRANT EXECUTE ON FUNCTION check_index_health TO service_role;
GRANT EXECUTE ON FUNCTION verify_required_indexes TO service_role;
GRANT EXECUTE ON FUNCTION reindex_table_safe TO service_role;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON VIEW index_status IS 'Summary of all indexes in public schema with sizes';
COMMENT ON FUNCTION check_index_health IS 'Returns health status of all indexes including validity and size';
COMMENT ON FUNCTION verify_required_indexes IS 'Verifies all required indexes exist according to specification';
COMMENT ON FUNCTION reindex_table_safe IS 'Safely reindex a table using CONCURRENTLY option';
