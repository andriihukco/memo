-- Add thread support to entries
-- thread_id: groups a conversation thread (user messages + bot replies)
-- bot_reply: the bot's reply text stored alongside the entry that triggered it
-- reply_to_entry_id: links a follow-up entry back to the entry it replied to

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS thread_id       UUID,
  ADD COLUMN IF NOT EXISTS bot_reply       TEXT,
  ADD COLUMN IF NOT EXISTS reply_to_entry_id UUID REFERENCES entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS entries_thread_id_idx ON entries(thread_id);
CREATE INDEX IF NOT EXISTS entries_reply_to_entry_id_idx ON entries(reply_to_entry_id);
