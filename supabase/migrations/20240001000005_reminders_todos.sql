-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  remind_at  TIMESTAMPTZ,
  repeat     TEXT NOT NULL DEFAULT 'none' CHECK (repeat IN ('none','daily','weekly')),
  done       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminders_user_id_idx ON reminders(user_id);
CREATE INDEX IF NOT EXISTS reminders_remind_at_idx ON reminders(remind_at);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY reminders_owner ON reminders
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Todos table
CREATE TABLE IF NOT EXISTS todos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  due_date   DATE,
  priority   TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  done       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos(user_id);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY todos_owner ON todos
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
