CREATE TABLE IF NOT EXISTS dm_messages (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dm_messages_from_to ON dm_messages(from_id, to_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_to_from ON dm_messages(to_id, from_id);
