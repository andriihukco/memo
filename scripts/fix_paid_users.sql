-- Find users who have an active subscription row but profile still shows 'free'
-- and fix them

UPDATE profiles p
SET
  subscription_tier    = s.tier,
  subscription_status  = 'active',
  subscription_ends_at = s.end_date
FROM subscriptions s
WHERE s.user_id = p.id
  AND s.status = 'active'
  AND (s.end_date IS NULL OR s.end_date > now())
  AND p.subscription_tier = 'free';

-- Show who was fixed
SELECT p.id, p.subscription_tier, p.subscription_status, p.subscription_ends_at, s.tier as sub_tier, s.end_date
FROM profiles p
JOIN subscriptions s ON s.user_id = p.id
WHERE s.status = 'active'
ORDER BY s.created_at DESC;
