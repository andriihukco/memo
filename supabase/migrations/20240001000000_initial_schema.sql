-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- profiles table: stores Telegram user identity and settings
CREATE TABLE profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id   BIGINT UNIQUE NOT NULL,
  username      TEXT,
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- entries table: stores diary entries with embeddings
CREATE TABLE entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content          TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('thoughts','ideas','feelings','expenses','calories','workout')),
  metadata         JSONB NOT NULL DEFAULT '{}',
  raw_media_url    TEXT,
  embedding        vector(768),
  embedding_status TEXT NOT NULL DEFAULT 'pending'
                   CHECK (embedding_status IN ('pending','done','failed')),
  branch_id        UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX entries_user_id_idx ON entries(user_id);
CREATE INDEX entries_category_idx ON entries(category);
CREATE INDEX entries_branch_id_idx ON entries(branch_id);
CREATE INDEX entries_embedding_idx ON entries
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- insights table: stores AI-generated insights linking entries
CREATE TABLE insights (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_id     UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  insight_text TEXT NOT NULL,
  branch_id    UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX insights_user_id_idx ON insights(user_id);
CREATE INDEX insights_entry_id_idx ON insights(entry_id);
CREATE INDEX insights_branch_id_idx ON insights(branch_id);
