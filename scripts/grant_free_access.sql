-- Grant permanent free Stars Pro access to telegram_id 6195181340
-- email: telegram_6195181340@memo.app
-- Run in Supabase SQL Editor — safe to run multiple times (idempotent)

DO $$
DECLARE
  v_user_id UUID;
  v_sub_id  UUID;
BEGIN
  SELECT id INTO v_user_id FROM profiles WHERE telegram_id = _8481763864;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User telegram_id=_8481763864 not found — skipping';
    RETURN;
  END IF;

  -- Upsert subscription (ON CONFLICT on the unique charge id = idempotent)
  INSERT INTO subscriptions (
    user_id, tier, status, start_date, end_date,
    telegram_payment_charge_id, provider_payment_charge_id
  )
  VALUES (
    v_user_id, 'stars_pro', 'active', now(), NULL,
    'free_access_8481763864', 'free_access_6195181340'
  )
  ON CONFLICT (telegram_payment_charge_id) DO UPDATE
    SET status = 'active', end_date = NULL, updated_at = now()
  RETURNING id INTO v_sub_id;

  -- Record the transaction (idempotent) — use exception handling
  BEGIN
    INSERT INTO subscription_transactions (
      subscription_id, user_id, amount, currency,
      telegram_payment_charge_id, provider_payment_charge_id,
      description, status
    )
    VALUES (
      v_sub_id, v_user_id, 0, 'XTR',
      'free_access_6195181340_tx', 'free_access_6195181340_tx',
      'Permanent free Stars Pro — telegram_6195181340@memo.app', 'succeeded'
    );
  EXCEPTION WHEN unique_violation THEN
    -- Transaction already exists, ignore
    NULL;
  END;

  -- Update profile tier (permanent, no expiry)
  UPDATE profiles
  SET subscription_tier    = 'stars_pro',
      subscription_status  = 'active',
      subscription_ends_at = NULL
  WHERE id = v_user_id;

  RAISE NOTICE 'Stars Pro granted to user % (telegram_id=6195181340)', v_user_id;
END;
$$;
