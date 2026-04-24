-- Telegram Stars Paywall Schema
-- Adds subscription tiers, payment tracking, and feature access control

-- subscriptions table: tracks user subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  telegram_payment_charge_id  TEXT NOT NULL UNIQUE,
  provider_payment_charge_id  TEXT NOT NULL UNIQUE,
  tier                        TEXT NOT NULL CHECK (tier IN ('free', 'stars_basic', 'stars_pro')),
  status                      TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'paused')),
  start_date                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date                    TIMESTAMPTZ,   -- NULL = permanent (free/granted) access
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx  ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_tier_idx    ON subscriptions(tier);

-- subscription_transactions table: tracks payment history
CREATE TABLE IF NOT EXISTS subscription_transactions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id             UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id                     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount                      BIGINT NOT NULL,
  currency                    TEXT NOT NULL DEFAULT 'XTR',  -- Telegram Stars currency code
  telegram_payment_charge_id  TEXT NOT NULL UNIQUE,
  provider_payment_charge_id  TEXT NOT NULL UNIQUE,
  description                 TEXT,
  status                      TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_transactions_user_id_idx         ON subscription_transactions(user_id);
CREATE INDEX IF NOT EXISTS subscription_transactions_subscription_id_idx ON subscription_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS subscription_transactions_created_at_idx      ON subscription_transactions(created_at DESC);

-- subscription_invoices table: tracks invoice generation for verification
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier            TEXT NOT NULL CHECK (tier IN ('stars_basic', 'stars_pro')),
  invoice_payload TEXT NOT NULL,
  amount          BIGINT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'XTR',
  status          TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS subscription_invoices_user_id_idx ON subscription_invoices(user_id);
CREATE INDEX IF NOT EXISTS subscription_invoices_status_idx  ON subscription_invoices(status);

-- Add subscription-related columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier    TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'stars_basic', 'stars_pro'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status  TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'past_due', 'canceled', 'paused'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;  -- NULL = permanent

-- Enable RLS
ALTER TABLE subscriptions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices      ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service role bypasses these; miniapp reads use auth.uid())
CREATE POLICY subscriptions_owner ON subscriptions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY subscription_transactions_owner ON subscription_transactions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY subscription_invoices_owner ON subscription_invoices
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Trigger: auto-set end_date for paid subscriptions ────────────────────────
-- Free/granted access uses charge id prefix 'free_access_' and keeps end_date NULL.
CREATE OR REPLACE FUNCTION update_subscription_end_date()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only auto-fill end_date when it wasn't explicitly provided
  IF NEW.end_date IS NULL AND NEW.status = 'active'
     AND NEW.telegram_payment_charge_id NOT LIKE 'free_access_%' THEN
    NEW.end_date := NEW.start_date + INTERVAL '30 days';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subscription_end_date
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_subscription_end_date();

-- ── Function: get active subscription ────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_active_subscription(p_user_id UUID)
RETURNS TABLE (id UUID, tier TEXT, status TEXT, start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.tier, s.status, s.start_date, s.end_date
  FROM subscriptions s
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND (s.end_date IS NULL OR s.end_date > now())
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;

-- ── Function: check premium access ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION has_premium_access(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_tier TEXT;
BEGIN
  SELECT subscription_tier INTO v_tier FROM profiles WHERE id = p_user_id;
  RETURN v_tier IN ('stars_basic', 'stars_pro');
END;
$$;

-- ── Function: upgrade subscription (called after successful payment) ──────────
CREATE OR REPLACE FUNCTION upgrade_subscription(
  p_user_id                    UUID,
  p_tier                       TEXT,
  p_telegram_payment_charge_id TEXT,
  p_provider_payment_charge_id TEXT
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  INSERT INTO subscriptions (user_id, tier, status, telegram_payment_charge_id, provider_payment_charge_id)
  VALUES (p_user_id, p_tier, 'active', p_telegram_payment_charge_id, p_provider_payment_charge_id)
  RETURNING id INTO v_subscription_id;

  UPDATE profiles
  SET subscription_tier    = p_tier,
      subscription_status  = 'active',
      subscription_ends_at = now() + INTERVAL '30 days'
  WHERE id = p_user_id;

  RETURN v_subscription_id;
END;
$$;

-- ── Function: downgrade / cancel subscription ─────────────────────────────────
CREATE OR REPLACE FUNCTION downgrade_subscription(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE subscriptions
  SET status = 'canceled', updated_at = now()
  WHERE user_id = p_user_id AND status = 'active';

  UPDATE profiles
  SET subscription_tier    = 'free',
      subscription_status  = 'canceled',
      subscription_ends_at = NULL
  WHERE id = p_user_id;
END;
$$;
