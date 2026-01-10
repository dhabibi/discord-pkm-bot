-- Migration 001: Core RLM Tables with pgvector Extension
-- Description: Sets up the foundation for RLM-py (Reflective Language Model) integration
--              including pgvector for embedding storage and semantic search capabilities
--
-- Tables created:
--   - rlm_memories: Core memory storage for RLM-py with vector embeddings
--   - rlm_contexts: Context windows for memory retrieval and reasoning
--   - rlm_memory_relations: Relationships between memories for graph traversal
--
-- Dependencies: pgvector extension

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Table: rlm_memories
-- Description: Core memory storage for RLM-py integration. Each memory represents
--              a piece of knowledge that can be retrieved via semantic search.
-- ============================================================================
CREATE TABLE IF NOT EXISTS rlm_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Content and metadata
    content TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'code', 'url', 'conversation', 'summary')),
    title TEXT,

    -- Source tracking
    source_type TEXT NOT NULL CHECK (source_type IN ('discord', 'manual', 'agent', 'import')),
    source_id TEXT,  -- External reference (e.g., discord message_id)
    source_url TEXT, -- Original URL if applicable

    -- Vector embedding for semantic search (1536 dimensions for OpenAI embeddings)
    embedding vector(1536),

    -- Categorization and tagging
    tags TEXT[] DEFAULT '{}',
    category TEXT,

    -- Importance and usage tracking
    importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,

    -- Temporal metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Soft delete support
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Versioning for content updates
    version INTEGER DEFAULT 1 NOT NULL,
    parent_memory_id UUID REFERENCES rlm_memories(id) ON DELETE SET NULL
);

-- ============================================================================
-- Table: rlm_contexts
-- Description: Context windows used during memory retrieval and reasoning.
--              Tracks which memories were used together in a context.
-- ============================================================================
CREATE TABLE IF NOT EXISTS rlm_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Context metadata
    name TEXT,
    description TEXT,
    context_type TEXT NOT NULL DEFAULT 'query' CHECK (context_type IN ('query', 'conversation', 'task', 'session')),

    -- The query or prompt that created this context
    query_text TEXT,
    query_embedding vector(1536),

    -- Context window configuration
    max_tokens INTEGER DEFAULT 4096,
    token_count INTEGER DEFAULT 0,

    -- Result tracking
    memory_ids UUID[] DEFAULT '{}',
    relevance_scores FLOAT[] DEFAULT '{}',

    -- Temporal metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Session tracking
    session_id TEXT,
    user_id TEXT
);

-- ============================================================================
-- Table: rlm_memory_relations
-- Description: Represents relationships between memories for graph-based
--              traversal and knowledge discovery.
-- ============================================================================
CREATE TABLE IF NOT EXISTS rlm_memory_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relationship endpoints
    source_memory_id UUID NOT NULL REFERENCES rlm_memories(id) ON DELETE CASCADE,
    target_memory_id UUID NOT NULL REFERENCES rlm_memories(id) ON DELETE CASCADE,

    -- Relationship metadata
    relation_type TEXT NOT NULL CHECK (relation_type IN (
        'references',      -- Source references target
        'summarizes',      -- Source is a summary of target
        'extends',         -- Source extends/elaborates on target
        'contradicts',     -- Source contradicts target
        'related_to',      -- General relationship
        'derived_from',    -- Source was derived from target
        'parent_of',       -- Hierarchical relationship
        'follows',         -- Temporal/sequential relationship
        'similar_to'       -- Semantic similarity
    )),

    -- Relationship strength (0-1)
    strength FLOAT DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),

    -- Additional context
    context TEXT,

    -- Temporal metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Prevent duplicate relationships
    CONSTRAINT unique_memory_relation UNIQUE (source_memory_id, target_memory_id, relation_type)
);

-- ============================================================================
-- Indexes for rlm_memories
-- ============================================================================

-- HNSW index for fast approximate nearest neighbor search on embeddings
-- Using cosine distance (vector_cosine_ops) which is standard for text embeddings
CREATE INDEX IF NOT EXISTS idx_rlm_memories_embedding_hnsw
    ON rlm_memories
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- GIN index for array-based tag search
CREATE INDEX IF NOT EXISTS idx_rlm_memories_tags_gin
    ON rlm_memories
    USING gin (tags);

-- B-tree indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_rlm_memories_source_type ON rlm_memories(source_type);
CREATE INDEX IF NOT EXISTS idx_rlm_memories_source_id ON rlm_memories(source_id);
CREATE INDEX IF NOT EXISTS idx_rlm_memories_content_type ON rlm_memories(content_type);
CREATE INDEX IF NOT EXISTS idx_rlm_memories_category ON rlm_memories(category);
CREATE INDEX IF NOT EXISTS idx_rlm_memories_importance ON rlm_memories(importance_score DESC);

-- BRIN index for time-series queries (efficient for large tables with time-ordered data)
CREATE INDEX IF NOT EXISTS idx_rlm_memories_created_at_brin
    ON rlm_memories
    USING brin (created_at)
    WITH (pages_per_range = 32);

-- Partial index for non-deleted memories (most queries filter out deleted)
CREATE INDEX IF NOT EXISTS idx_rlm_memories_active
    ON rlm_memories(created_at DESC)
    WHERE deleted_at IS NULL;

-- ============================================================================
-- Indexes for rlm_contexts
-- ============================================================================

-- HNSW index for query embedding search
CREATE INDEX IF NOT EXISTS idx_rlm_contexts_query_embedding_hnsw
    ON rlm_contexts
    USING hnsw (query_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Session and user lookup
CREATE INDEX IF NOT EXISTS idx_rlm_contexts_session_id ON rlm_contexts(session_id);
CREATE INDEX IF NOT EXISTS idx_rlm_contexts_user_id ON rlm_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_rlm_contexts_context_type ON rlm_contexts(context_type);

-- BRIN for temporal queries
CREATE INDEX IF NOT EXISTS idx_rlm_contexts_created_at_brin
    ON rlm_contexts
    USING brin (created_at)
    WITH (pages_per_range = 32);

-- ============================================================================
-- Indexes for rlm_memory_relations
-- ============================================================================

-- Efficient graph traversal indexes
CREATE INDEX IF NOT EXISTS idx_rlm_memory_relations_source ON rlm_memory_relations(source_memory_id);
CREATE INDEX IF NOT EXISTS idx_rlm_memory_relations_target ON rlm_memory_relations(target_memory_id);
CREATE INDEX IF NOT EXISTS idx_rlm_memory_relations_type ON rlm_memory_relations(relation_type);

-- Composite index for finding all relations of a specific type for a memory
CREATE INDEX IF NOT EXISTS idx_rlm_memory_relations_source_type
    ON rlm_memory_relations(source_memory_id, relation_type);

-- ============================================================================
-- Table Comments
-- ============================================================================
COMMENT ON TABLE rlm_memories IS 'Core memory storage for RLM-py integration with vector embeddings for semantic search';
COMMENT ON TABLE rlm_contexts IS 'Context windows tracking memory retrieval and reasoning sessions';
COMMENT ON TABLE rlm_memory_relations IS 'Graph relationships between memories for knowledge traversal';

COMMENT ON COLUMN rlm_memories.embedding IS 'Vector embedding (1536 dimensions) for semantic similarity search using OpenAI-compatible embeddings';
COMMENT ON COLUMN rlm_memories.importance_score IS 'Calculated importance score (0-1) based on access frequency, recency, and explicit ratings';
COMMENT ON COLUMN rlm_memories.parent_memory_id IS 'Reference to previous version of this memory for version history tracking';

COMMENT ON COLUMN rlm_contexts.memory_ids IS 'Array of memory IDs included in this context window';
COMMENT ON COLUMN rlm_contexts.relevance_scores IS 'Corresponding relevance scores for each memory in memory_ids array';

COMMENT ON COLUMN rlm_memory_relations.strength IS 'Relationship strength/confidence score (0-1)';
