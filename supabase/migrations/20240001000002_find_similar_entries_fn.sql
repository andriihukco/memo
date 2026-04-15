-- Function: find_similar_entries
-- Returns the top-K most similar entries for a given user, excluding a specific entry,
-- ordered by cosine similarity descending.

CREATE OR REPLACE FUNCTION find_similar_entries(
  p_user_id   UUID,
  p_embedding vector(768),
  p_exclude_id UUID,
  p_top_k     INT DEFAULT 5
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
  ORDER BY e.embedding <=> p_embedding
  LIMIT p_top_k;
$$;
