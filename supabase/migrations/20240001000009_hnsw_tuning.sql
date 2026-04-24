-- Migration: tune HNSW index parameters for production diary scale
-- Replaces the default m=16/ef_construction=64 with m=24/ef_construction=128
-- and adds a partial index that skips un-embedded entries.

-- Drop the old full-table index
DROP INDEX IF EXISTS entries_embedding_idx;

-- Partial index: only index rows that have been successfully embedded.
-- Smaller index → faster builds, better recall per byte of memory.
CREATE INDEX entries_embedding_idx ON entries
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 128)
  WHERE embedding_status = 'done' AND embedding IS NOT NULL;

-- Composite index for the most common query pattern:
-- user_id + embedding_status + created_at (used by loop.ts and qa.ts)
CREATE INDEX IF NOT EXISTS entries_user_status_created_idx
  ON entries(user_id, embedding_status, created_at DESC)
  WHERE embedding_status = 'done';

-- Raise ef_search for the find_similar_entries function so query-time
-- graph traversal is deeper (better recall at the cost of ~2ms extra latency).
ALTER FUNCTION find_similar_entries SET hnsw.ef_search = 100;
