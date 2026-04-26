-- Upgrade all users to stars_pro (Supernova) permanently
UPDATE profiles
SET
  subscription_tier    = 'stars_pro',
  subscription_status  = 'active',
  subscription_ends_at = NULL;

-- Show all users with id, telegram_id, username and current tier
SELECT
  id,
  telegram_id,
  username,
  subscription_tier,
  subscription_status,
  subscription_ends_at
FROM profiles
ORDER BY created_at;
