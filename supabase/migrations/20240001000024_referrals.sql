-- Migration: referrals table for the referral system (Req 14)

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  reward_granted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by referrer
CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON referrals (referrer_id);

-- Index for fast lookup by code (used on /start with ref_ param)
CREATE INDEX IF NOT EXISTS referrals_code_idx ON referrals (code);

-- Index for fast lookup by referred user
CREATE INDEX IF NOT EXISTS referrals_referred_id_idx ON referrals (referred_id) WHERE referred_id IS NOT NULL;

-- RLS: users can only see their own referral rows (as referrer or referred)
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referrals"
  ON referrals FOR SELECT
  USING (
    referrer_id IN (SELECT id FROM profiles WHERE telegram_id = (auth.uid())::bigint)
    OR referred_id IN (SELECT id FROM profiles WHERE telegram_id = (auth.uid())::bigint)
  );

-- Service role bypasses RLS for bot/cron operations
