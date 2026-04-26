-- Add subscription_start_date to profiles
-- This column was referenced in code but never added to the schema.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ;

-- Backfill from subscriptions table for existing paid users
UPDATE profiles p
SET subscription_start_date = s.start_date
FROM (
  SELECT DISTINCT ON (user_id) user_id, start_date
  FROM subscriptions
  WHERE status = 'active'
  ORDER BY user_id, created_at DESC
) s
WHERE p.id = s.user_id
  AND p.subscription_start_date IS NULL;
