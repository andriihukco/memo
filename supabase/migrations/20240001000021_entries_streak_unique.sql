-- Migration: unique constraint for idempotent autoIncrementStreaks inserts
-- Req 23.1: autoIncrementStreaks() SHALL use ON CONFLICT DO NOTHING on a unique
-- constraint covering (user_id, category, DATE(created_at)).
--
-- We use a partial unique index scoped to auto-generated streak entries
-- (metadata->>'auto_streak' = 'true') so that normal user entries in the same
-- category on the same day are not blocked.

CREATE UNIQUE INDEX IF NOT EXISTS entries_auto_streak_unique_idx
  ON entries (user_id, category, DATE(created_at))
  WHERE (metadata->>'auto_streak')::boolean = true;
