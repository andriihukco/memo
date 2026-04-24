-- Add structured retrospective columns to reports table
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS went_well           TEXT,
  ADD COLUMN IF NOT EXISTS didnt_go_well       TEXT,
  ADD COLUMN IF NOT EXISTS start_stop_continue TEXT,
  ADD COLUMN IF NOT EXISTS experiment          TEXT,
  ADD COLUMN IF NOT EXISTS lesson              TEXT;
