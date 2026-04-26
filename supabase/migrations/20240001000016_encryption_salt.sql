-- Add per-user encryption salt column to profiles.
-- Nullable so existing rows are unaffected (backward-compatible).
-- New profiles will have a random 32-byte hex salt generated at creation time.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS encryption_salt TEXT;
