-- Media attached to a timeline entry: photos, videos, audio notes and music links.
-- Files live in a private bucket; rows here point at them. Owners only, enforced by RLS.

CREATE TABLE IF NOT EXISTS entry_media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id     uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('photo', 'video', 'audio', 'music')),
  storage_path text,
  mime         text,
  bytes        integer NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  duration_s   integer CHECK (duration_s IS NULL OR duration_s >= 0),
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entry_media_entry_idx ON entry_media (entry_id);

ALTER TABLE entry_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entry_media_owner ON entry_media;
CREATE POLICY entry_media_owner ON entry_media
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Private bucket. Reads go through short-lived signed URLs issued by the API.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('entry-media', 'entry-media', false, 52428800)
ON CONFLICT (id) DO NOTHING;
