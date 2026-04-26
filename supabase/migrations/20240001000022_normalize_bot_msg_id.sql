-- Normalize bot_msg_id in entry metadata from JSON number to JSON string.
-- Idempotent: the WHERE clause restricts to rows where bot_msg_id is still a number,
-- so running this migration multiple times is safe.
UPDATE entries
SET metadata = jsonb_set(
  metadata,
  '{bot_msg_id}',
  to_jsonb((metadata->>'bot_msg_id')::text)
)
WHERE metadata ? 'bot_msg_id'
  AND jsonb_typeof(metadata->'bot_msg_id') = 'number';
