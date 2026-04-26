-- Step 1: Check current state of all profiles
SELECT id, subscription_tier, subscription_status, subscription_ends_at
FROM profiles
ORDER BY created_at;

-- Step 2: Direct UPDATE — no subscriptions table dependency
UPDATE profiles
SET
  subscription_tier    = 'stars_pro',
  subscription_status  = 'active',
  subscription_ends_at = NULL
WHERE id IN (
  '29e45b1b-a234-4e7f-9ba8-72c84ab3ee18',
  '4fe5edf2-92d7-46e6-9c9f-3120108f6b9b',
  '6142252a-e8ea-4fa8-8b8f-81c1a6cfed2f',
  '9a330005-4558-4f05-bffb-ef237e34e754',
  'f1d68cb3-4e00-4b7f-b46c-b956c9c7b10b'
);

-- Step 3: Verify
SELECT id, subscription_tier, subscription_status, subscription_ends_at
FROM profiles
ORDER BY created_at;
