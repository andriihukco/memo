-- Grant permanent Stars Pro to telegram_id 434214225
-- Run once the user has signed up (profile not found at time of initial grant)

DO $$
DECLARE
  v_user_id UUID;
  v_sub_id  UUID;
BEGIN
  SELECT id INTO v_user_id FROM profiles WHERE telegram_id = 434214225;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User telegram_id=434214225 not found — have they started the bot yet?';
    RETURN;
  END IF;

  INSERT INTO subscriptions (user_id, tier, status, start_date, end_date, telegram_payment_charge_id, provider_payment_charge_id)
  VALUES (v_user_id, 'stars_pro', 'active', now(), NULL, 'free_access_434214225', 'free_access_434214225')
  ON CONFLICT (telegram_payment_charge_id) DO UPDATE SET status = 'active', end_date = NULL, updated_at = now()
  RETURNING id INTO v_sub_id;

  BEGIN
    INSERT INTO subscription_transactions (subscription_id, user_id, amount, currency, telegram_payment_charge_id, provider_payment_charge_id, description, status)
    VALUES (v_sub_id, v_user_id, 0, 'XTR', 'free_access_434214225_tx', 'free_access_434214225_tx', 'Permanent Stars Pro — tg 434214225', 'succeeded');
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  UPDATE profiles SET subscription_tier = 'stars_pro', subscription_status = 'active', subscription_ends_at = NULL WHERE id = v_user_id;
  RAISE NOTICE 'Stars Pro granted to % (telegram_id=434214225)', v_user_id;
END;
$$;
