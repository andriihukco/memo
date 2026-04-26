-- Grant stars_basic (Memo Nova) to telegram_id 7633172724
-- Subscription expires in 7 days so the "expiring soon" UI is visible

UPDATE profiles
SET
  subscription_tier        = 'stars_basic',
  subscription_status      = 'active',
  subscription_start_date  = now() - INTERVAL '23 days',  -- started 23 days ago
  subscription_ends_at     = now() + INTERVAL '7 days'    -- expires in 7 days
WHERE telegram_id = '7633172724';

-- Verify
SELECT
  telegram_id,
  subscription_tier,
  subscription_status,
  subscription_start_date,
  subscription_ends_at
FROM profiles
WHERE telegram_id = '7633172724';
