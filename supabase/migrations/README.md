# Database Migrations for Discord PKM Bot with RLM-py

This directory contains SQL migrations for the Discord PKM Bot with RLM-py (Reflective Language Model) integration.

## Migration Order

Migrations must be executed in order:

| Migration | Description | Dependencies |
|-----------|-------------|--------------|
| `001_core_rlm_tables.sql` | Core RLM tables with pgvector extension | None |
| `002_agent_tasks_tracking.sql` | Agent tasks and results tracking | Migration 001 |
| `003_enhanced_discord_tables.sql` | Enhanced Discord tables with FTS | Migration 001 |
| `004_row_level_security.sql` | Row Level Security policies | Migrations 001-003 |
| `005_audit_logging.sql` | Audit logging triggers | Migrations 001-003 |
| `006_index_verification.sql` | Index verification helpers | Migrations 001-005 |

## Prerequisites

- Supabase project with PostgreSQL 15+
- pgvector extension available (enabled in Migration 001)
- Service role key for running migrations

## Running Migrations

### Option 1: Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste each migration file in order
4. Execute each migration

### Option 2: Supabase CLI

```bash
# Initialize Supabase (if not already done)
supabase init

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### Option 3: Direct PostgreSQL Connection

```bash
# Using psql
psql $DATABASE_URL -f supabase/migrations/001_core_rlm_tables.sql
psql $DATABASE_URL -f supabase/migrations/002_agent_tasks_tracking.sql
psql $DATABASE_URL -f supabase/migrations/003_enhanced_discord_tables.sql
psql $DATABASE_URL -f supabase/migrations/004_row_level_security.sql
psql $DATABASE_URL -f supabase/migrations/005_audit_logging.sql
psql $DATABASE_URL -f supabase/migrations/006_index_verification.sql
```

## Schema Overview

### Core RLM Tables (Migration 001)

- **rlm_memories**: Core memory storage with vector embeddings
- **rlm_contexts**: Context windows for memory retrieval
- **rlm_memory_relations**: Graph relationships between memories

### Agent Tables (Migration 002)

- **agent_sessions**: Agent session management
- **agent_tasks**: Task queue and execution tracking
- **agent_results**: Task execution results
- **agent_logs**: Detailed execution logs

### Discord Tables (Migration 003)

- **discord_links**: Extended with embeddings, FTS, and RLM integration
- **discord_channels**: Channel metadata and settings
- **discord_guilds**: Guild configuration

### Supporting Tables (Migration 005)

- **audit_log**: Central audit log for all data changes

## Index Types

The schema uses optimized indexes for different query patterns:

### HNSW Indexes (Semantic Search)
- `rlm_memories.embedding`
- `rlm_contexts.query_embedding`
- `discord_links.embedding`
- `agent_results.result_embedding`

### GIN Indexes (Array/JSON/FTS)
- Array fields: `tags`, `allowed_channels`, etc.
- JSONB fields: `input_data`, `result_data`, `details`
- Full-text: `discord_links.fts_vector`

### BRIN Indexes (Time-Series)
- All `created_at` columns on high-volume tables

## Row Level Security (RLS)

RLS policies are implemented in Migration 004:

- **Service Role**: Full access to all tables
- **Authenticated Users**: Access scoped by guild membership
- **Anonymous**: No access

JWT claims expected:
- `user_id`: Discord user ID
- `guild_ids`: Comma-separated list of guild IDs
- `role`: `service_role` | `authenticated` | `anon`

## Audit Logging

Migration 005 sets up automatic audit logging for:

- All RLM memory operations
- Agent session and task changes
- Discord link modifications
- Channel and guild configuration changes

High-volume tables (contexts, results, logs) are excluded from auditing.

### Audit Log Retention

```sql
-- Clean up audit logs older than 90 days
SELECT cleanup_old_audit_logs(90);
```

## Verification

After running migrations, verify indexes:

```sql
-- Check all required indexes exist
SELECT * FROM verify_required_indexes();

-- Check index health
SELECT * FROM check_index_health();

-- View index status
SELECT * FROM index_status;
```

## Rollback

To rollback migrations, execute in reverse order:

```sql
-- Rollback 006
DROP VIEW IF EXISTS index_status;
DROP FUNCTION IF EXISTS check_index_health;
DROP FUNCTION IF EXISTS verify_required_indexes;
DROP FUNCTION IF EXISTS reindex_table_safe;

-- Rollback 005
DROP VIEW IF EXISTS audit_recent_activity;
DROP VIEW IF EXISTS audit_user_activity;
DROP TABLE IF EXISTS audit_log;
DROP FUNCTION IF EXISTS audit_trigger_function;
DROP FUNCTION IF EXISTS cleanup_old_audit_logs;

-- Rollback 004
-- Drop all policies (see migration file for full list)
-- DROP POLICY ... ON ...;
DROP FUNCTION IF EXISTS auth.user_has_guild_access;
DROP FUNCTION IF EXISTS auth.current_user_id;
DROP FUNCTION IF EXISTS auth.is_service_role;

-- Rollback 003
DROP TABLE IF EXISTS discord_guilds;
DROP TABLE IF EXISTS discord_channels;
DROP FUNCTION IF EXISTS discord_links_fts_trigger;
DROP FUNCTION IF EXISTS update_updated_at_column;
-- Note: ALTER TABLE changes to discord_links must be reverted manually

-- Rollback 002
DROP TABLE IF EXISTS agent_logs;
DROP TABLE IF EXISTS agent_results;
DROP TABLE IF EXISTS agent_tasks;
DROP TABLE IF EXISTS agent_sessions;

-- Rollback 001
DROP TABLE IF EXISTS rlm_memory_relations;
DROP TABLE IF EXISTS rlm_contexts;
DROP TABLE IF EXISTS rlm_memories;
-- Note: Don't drop pgvector extension if other tables use it
```

## CI/CD Integration

For CI/CD pipelines, use the Supabase CLI or direct psql execution:

```yaml
# Example GitHub Actions step
- name: Run migrations
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: |
    for f in supabase/migrations/*.sql; do
      psql $DATABASE_URL -f "$f"
    done
```
