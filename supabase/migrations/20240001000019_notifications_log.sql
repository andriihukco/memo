-- Migration: notifications_log table for idempotent streak/weekly notifications
-- Req 11.4: Process streak notifications with idempotency — no duplicate messages same day

CREATE TABLE IF NOT EXISTS notifications_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,
  date        DATE        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT notifications_log_user_type_date_key UNIQUE (user_id, type, date)
);

-- Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS notifications_log_user_id_idx ON notifications_log (user_id);
