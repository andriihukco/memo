-- Add trial_used column to profiles for free trial tracking (Req 13)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_used BOOLEAN NOT NULL DEFAULT false;
