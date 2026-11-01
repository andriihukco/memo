-- Web accounts: email, Google and Telegram Login Widget users without a Telegram chat.
--
-- 1. profiles.telegram_id becomes nullable (UNIQUE stays, so one Telegram id still maps to one profile).
-- 2. profiles.encryption_key_id pins the identity used for entry key derivation. It is fixed
--    at creation, so linking Telegram later never changes the key of existing entries.
-- 3. A trigger creates a profile for every new auth user that did not come from Telegram.

ALTER TABLE profiles ALTER COLUMN telegram_id DROP NOT NULL;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS encryption_key_id TEXT;

-- Telegram profiles keep the key they already use.
UPDATE profiles
   SET encryption_key_id = telegram_id::text
 WHERE encryption_key_id IS NULL AND telegram_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_web_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Telegram sign-ins create their profile in the app (resolveOrCreateProfile).
  IF NEW.raw_user_meta_data ? 'telegram_id' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, encryption_salt, encryption_key_id)
  VALUES (
    NEW.id,
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    NEW.id::text
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_web ON auth.users;
CREATE TRIGGER on_auth_user_created_web
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_web_user();
