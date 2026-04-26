-- Migration: add scheduled_at and status columns to reminders table
-- The existing reminders table uses remind_at/done; this migration adds
-- the new columns required by the bot reminder feature (Req 10).

-- Add scheduled_at column (maps to the new reminder scheduling field)
ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Add status column with check constraint
ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'cancelled'));

-- Partial index for efficient cron queries: only pending reminders by time
CREATE INDEX IF NOT EXISTS reminders_scheduled_at_pending_idx
  ON reminders (scheduled_at)
  WHERE status = 'pending';

-- Backfill: map existing remind_at -> scheduled_at and done -> status
UPDATE reminders
SET
  scheduled_at = remind_at,
  status = CASE WHEN done THEN 'sent' ELSE 'pending' END
WHERE scheduled_at IS NULL;
