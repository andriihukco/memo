-- Migration: unique constraint for idempotent autoIncrementStreaks inserts
-- Req 23.1: autoIncrementStreaks() SHALL use ON CONFLICT DO NOTHING on a unique
-- constraint covering (user_id, category, DATE(created_at)).
--
-- We use a partial unique index scoped to auto-generated streak entries
-- (metadata->>'auto_streak' = 'true') so that normal user entries in the same
-- category on the same day are not blocked.
--
-- Note: Postgres requires all functions in index expressions to be IMMUTABLE.
-- TIMESTAMPTZ -> date conversion is timezone-dependent (not immutable by default).
-- We create a small IMMUTABLE wrapper that pins the conversion to UTC, then
-- use it in the index expression.

CREATE OR REPLACE FUNCTION entries_created_at_utc_date(ts TIMESTAMPTZ)
RETURNS DATE
LANGUAGE SQL
IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT (ts AT TIME ZONE 'UTC')::date;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS entries_auto_streak_unique_idx
  ON entries (user_id, category, entries_created_at_utc_date(created_at))
  WHERE (metadata->>'auto_streak') = 'true';
