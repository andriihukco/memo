-- Enable RLS and add owner policies for reminders and todos
-- (tables were created without RLS in migration 000005)

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reminders' AND policyname = 'reminders_owner'
  ) THEN
    CREATE POLICY reminders_owner ON reminders
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'todos' AND policyname = 'todos_owner'
  ) THEN
    CREATE POLICY todos_owner ON todos
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Also add priority column if it doesn't exist yet (added in 000005 update)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
  CHECK (priority IN ('low','medium','high'));
