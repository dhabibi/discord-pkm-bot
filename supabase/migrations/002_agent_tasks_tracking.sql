-- Migration 002: Agent Tasks and Results Tracking
-- Description: Tables for tracking AI agent tasks, their execution status,
--              and results. Supports the RLM-py agent orchestration system.
--
-- Tables created:
--   - agent_tasks: Task queue and execution tracking
--   - agent_results: Detailed results from task execution
--   - agent_sessions: Agent session management
--   - agent_logs: Detailed execution logs for debugging

-- ============================================================================
-- Table: agent_sessions
-- Description: Tracks agent sessions for grouping related tasks and maintaining
--              state across multiple interactions.
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Session identification
    session_type TEXT NOT NULL DEFAULT 'chat' CHECK (session_type IN ('chat', 'background', 'scheduled', 'triggered')),

    -- User/context tracking
    user_id TEXT,
    channel_id TEXT,
    guild_id TEXT,

    -- Session state
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed', 'expired')),

    -- Configuration
    config JSONB DEFAULT '{}',
    max_tasks INTEGER DEFAULT 100,
    timeout_seconds INTEGER DEFAULT 3600,

    -- Metrics
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,

    -- Temporal metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- Table: agent_tasks
-- Description: Queue and tracking for agent tasks. Each task represents a
--              discrete unit of work to be performed by an agent.
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Session relationship
    session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,

    -- Task identification
    task_type TEXT NOT NULL CHECK (task_type IN (
        'embed',           -- Generate embeddings for content
        'summarize',       -- Summarize content
        'extract',         -- Extract structured data
        'search',          -- Semantic search
        'classify',        -- Classify/categorize content
        'link_analysis',   -- Analyze links/URLs
        'memory_update',   -- Update memory store
        'memory_retrieve', -- Retrieve from memory
        'custom'           -- Custom task type
    )),

    -- Task definition
    name TEXT NOT NULL,
    description TEXT,
    input_data JSONB NOT NULL DEFAULT '{}',

    -- Priority and scheduling
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    scheduled_for TIMESTAMP WITH TIME ZONE,
    deadline TIMESTAMP WITH TIME ZONE,

    -- Execution state
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Waiting to be processed
        'queued',       -- In processing queue
        'running',      -- Currently executing
        'completed',    -- Successfully finished
        'failed',       -- Execution failed
        'cancelled',    -- Manually cancelled
        'timeout',      -- Exceeded time limit
        'retry'         -- Scheduled for retry
    )),

    -- Retry configuration
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    retry_delay_seconds INTEGER DEFAULT 60,
    last_error TEXT,

    -- Progress tracking
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    progress_message TEXT,

    -- Resource tracking
    estimated_tokens INTEGER,
    actual_tokens INTEGER,
    model_used TEXT,

    -- Execution timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    queued_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Parent task for sub-tasks
    parent_task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,

    -- Idempotency key for duplicate prevention
    idempotency_key TEXT UNIQUE
);

-- ============================================================================
-- Table: agent_results
-- Description: Stores detailed results from agent task execution.
--              Separated from tasks for efficient storage and querying.
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Task relationship
    task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,

    -- Result data
    result_type TEXT NOT NULL DEFAULT 'json' CHECK (result_type IN ('json', 'text', 'embedding', 'binary', 'error')),
    result_data JSONB,
    result_text TEXT,
    result_embedding vector(1536),

    -- Quality metrics
    confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
    quality_score FLOAT CHECK (quality_score >= 0 AND quality_score <= 1),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Temporal
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Memory integration
    memory_id UUID REFERENCES rlm_memories(id) ON DELETE SET NULL
);

-- ============================================================================
-- Table: agent_logs
-- Description: Detailed execution logs for debugging and monitoring.
--              High-volume table optimized for append-only workloads.
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Task/session relationship
    task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
    session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,

    -- Log level and categorization
    level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
    category TEXT DEFAULT 'general',

    -- Log content
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',

    -- Context
    source TEXT,  -- Component/function that generated the log
    trace_id TEXT, -- Correlation ID for distributed tracing

    -- Temporal (not null for partitioning)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- Indexes for agent_sessions
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_channel_id ON agent_sessions(channel_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_guild_id ON agent_sessions(guild_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_type ON agent_sessions(session_type);

-- BRIN for time-based queries
CREATE INDEX IF NOT EXISTS idx_agent_sessions_created_at_brin
    ON agent_sessions
    USING brin (created_at)
    WITH (pages_per_range = 32);

-- Partial index for active sessions
CREATE INDEX IF NOT EXISTS idx_agent_sessions_active
    ON agent_sessions(updated_at DESC)
    WHERE status = 'active';

-- ============================================================================
-- Indexes for agent_tasks
-- ============================================================================

-- Status-based queries (most common)
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);

-- Priority queue ordering
CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority_queue
    ON agent_tasks(priority DESC, created_at ASC)
    WHERE status IN ('pending', 'queued', 'retry');

-- Task type filtering
CREATE INDEX IF NOT EXISTS idx_agent_tasks_task_type ON agent_tasks(task_type);

-- Session relationship
CREATE INDEX IF NOT EXISTS idx_agent_tasks_session_id ON agent_tasks(session_id);

-- Parent task lookup
CREATE INDEX IF NOT EXISTS idx_agent_tasks_parent_id ON agent_tasks(parent_task_id);

-- Scheduled tasks
CREATE INDEX IF NOT EXISTS idx_agent_tasks_scheduled
    ON agent_tasks(scheduled_for)
    WHERE scheduled_for IS NOT NULL AND status = 'pending';

-- BRIN for temporal queries
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_at_brin
    ON agent_tasks
    USING brin (created_at)
    WITH (pages_per_range = 32);

-- GIN index for JSON input data queries
CREATE INDEX IF NOT EXISTS idx_agent_tasks_input_data_gin
    ON agent_tasks
    USING gin (input_data jsonb_path_ops);

-- ============================================================================
-- Indexes for agent_results
-- ============================================================================

-- Task lookup
CREATE INDEX IF NOT EXISTS idx_agent_results_task_id ON agent_results(task_id);

-- Result type filtering
CREATE INDEX IF NOT EXISTS idx_agent_results_result_type ON agent_results(result_type);

-- Memory integration
CREATE INDEX IF NOT EXISTS idx_agent_results_memory_id ON agent_results(memory_id);

-- GIN for JSON result queries
CREATE INDEX IF NOT EXISTS idx_agent_results_result_data_gin
    ON agent_results
    USING gin (result_data jsonb_path_ops);

-- HNSW for embedding similarity search on results
CREATE INDEX IF NOT EXISTS idx_agent_results_embedding_hnsw
    ON agent_results
    USING hnsw (result_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- Indexes for agent_logs
-- ============================================================================

-- Primary query patterns
CREATE INDEX IF NOT EXISTS idx_agent_logs_task_id ON agent_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_session_id ON agent_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_level ON agent_logs(level);
CREATE INDEX IF NOT EXISTS idx_agent_logs_category ON agent_logs(category);
CREATE INDEX IF NOT EXISTS idx_agent_logs_trace_id ON agent_logs(trace_id);

-- BRIN for time-series log queries (logs are append-only, time-ordered)
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at_brin
    ON agent_logs
    USING brin (created_at)
    WITH (pages_per_range = 128);  -- Larger range for high-volume logs

-- Composite index for log analysis
CREATE INDEX IF NOT EXISTS idx_agent_logs_level_created
    ON agent_logs(level, created_at DESC);

-- GIN for details JSON search
CREATE INDEX IF NOT EXISTS idx_agent_logs_details_gin
    ON agent_logs
    USING gin (details jsonb_path_ops);

-- ============================================================================
-- Table Comments
-- ============================================================================
COMMENT ON TABLE agent_sessions IS 'Tracks agent sessions for grouping related tasks and maintaining state';
COMMENT ON TABLE agent_tasks IS 'Task queue and execution tracking for AI agent operations';
COMMENT ON TABLE agent_results IS 'Detailed results from agent task execution with optional embeddings';
COMMENT ON TABLE agent_logs IS 'Execution logs for debugging and monitoring agent operations';

COMMENT ON COLUMN agent_tasks.priority IS 'Task priority (1-10, higher = more urgent)';
COMMENT ON COLUMN agent_tasks.idempotency_key IS 'Unique key to prevent duplicate task creation';
COMMENT ON COLUMN agent_tasks.progress_percent IS 'Task completion progress (0-100)';

COMMENT ON COLUMN agent_results.confidence_score IS 'Model confidence in the result (0-1)';
COMMENT ON COLUMN agent_results.memory_id IS 'Reference to memory created from this result';

COMMENT ON COLUMN agent_logs.trace_id IS 'Correlation ID for distributed tracing across services';
