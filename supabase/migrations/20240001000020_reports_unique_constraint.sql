-- Add unique constraint on reports(user_id, period_from, period_to)
-- Enables ON CONFLICT DO NOTHING for idempotent weekly summary inserts (Req 23.2)
ALTER TABLE reports
  ADD CONSTRAINT IF NOT EXISTS reports_user_period_unique
  UNIQUE (user_id, period_from, period_to);
