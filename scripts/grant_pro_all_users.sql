-- Grant permanent Stars Pro to all current users
-- UUIDs from screenshot: marinaaudo, get_memo_help, justinskincare, 6195181340, 7633172724

DO $$
DECLARE
  v_ids UUID[] := ARRAY[
    '29e45b1b-a234-4e7f-9ba8-72c84ab3ee18',
    '4fe5edf2-92d7-46e6-9c9f-3120108f6b9b',
    '6142252a-e8ea-4fa8-8b8f-81c1a6cfed2f',
    '9a330005-4558-4f05-bffb-ef237e34e754',
    'f1d68cb3-4e00-4b7f-b46c-b956c9c7b10b'
  ];
  v_user_id UUID;
  v_sub_id  UUID;
  v_tag     TEXT;
BEGIN
  FOREACH v_user_id IN ARRAY v_ids LOOP
    v_tag := 'free_access_' || replace(v_user_id::text, '-', '');

    INSERT INTO subscriptions (
      user_id, tier, status, start_date, end_date,
      telegram_payment_charge_id, provider_payment_charge_id
    )
    VALUES (
      v_user_id, 'stars_pro', 'active', now(), NULL,
      v_tag, v_tag
    )
    ON CONFLICT (telegram_payment_charge_id)
      DO UPDATE SET status = 'active', end_date = NULL, updated_at = now()
    RETURNING id INTO v_sub_id;

    BEGIN
      INSERT INTO subscription_transactions (
        subscription_id, user_id, amount, currency,
        telegram_payment_charge_id, provider_payment_charge_id,
        description, status
      )
      VALUES (
        v_sub_id, v_user_id, 0, 'XTR',
        v_tag || '_tx', v_tag || '_tx',
        'Permanent Stars Pro — ' || v_user_id, 'succeeded'
      );
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    UPDATE profiles
    SET subscription_tier    = 'stars_pro',
        subscription_status  = 'active',
        subscription_ends_at = NULL
    WHERE id = v_user_id;

    RAISE NOTICE 'Stars Pro granted to %', v_user_id;
  END LOOP;
END;
$$;
