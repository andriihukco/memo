-- Add unique constraint on reports(user_id, period_from, period_to)
-- Enables ON CONFLICT DO NOTHING for idempotent weekly summary inserts (Req 23.2)
-- Note: ADD CONSTRAINT IF NOT EXISTS is not valid PostgreSQL syntax;
-- we guard with a DO block checking pg_constraint instead.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reports_user_period_unique'
      AND conrelid = 'reports'::regclass
  ) THEN
    ALTER TABLE reports
      ADD CONSTRAINT reports_user_period_unique
      UNIQUE (user_id, period_from, period_to);
  END IF;
END $$;
