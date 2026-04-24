-- Migration: support all-time semantic search and user memory
-- 1. Add a variant of find_similar_entries without date filtering (for QA all-time)
-- 2. Memory is stored in profiles.settings.memory (JSONB) — no schema change needed

-- All-time semantic search: no user_id restriction on date, just top-K by cosine similarity
CREATE OR REPLACE FUNCTION find_similar_entries_alltime(
  p_user_id    UUID,
  p_embedding  vector(768),
  p_exclude_id UUID,
  p_top_k      INT DEFAULT 10
)
RETURNS TABLE (
  id          UUID,
  content     TEXT,
  category    TEXT,
  created_at  TIMESTAMPTZ,
  similarity  FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.id,
    e.content,
    e.category,
    e.created_at,
    1 - (e.embedding <=> p_embedding) AS similarity
  FROM entries e
  WHERE e.user_id    = p_user_id
    AND e.id        != p_exclude_id
    AND e.embedding IS NOT NULL
    AND e.embedding_status = 'done'
  ORDER BY e.embedding <=> p_embedding
  LIMIT p_top_k;
$$;

-- Set ef_search for all-time search too
ALTER FUNCTION find_similar_entries_alltime SET hnsw.ef_search = 100;
