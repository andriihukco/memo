-- Add embedding_attempts column to entries table
-- Tracks how many times embedding generation has been attempted for an entry.
-- Used by retryFailedEmbeddings() to avoid retrying entries that have already
-- exhausted their attempt budget (>= 3 attempts).
ALTER TABLE entries ADD COLUMN IF NOT EXISTS embedding_attempts INT NOT NULL DEFAULT 0;
