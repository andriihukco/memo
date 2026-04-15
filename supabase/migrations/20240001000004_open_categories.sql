-- Remove the hardcoded category CHECK constraint so new categories can be created dynamically
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_category_check;

-- Add a categories table to track all known categories per user
CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  label_ua   TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT 'bg-gray-100 text-gray-700',
  icon       TEXT NOT NULL DEFAULT 'tag',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS categories_user_id_idx ON categories(user_id);

-- Seed built-in categories (will be inserted per-user on first use by the app)
