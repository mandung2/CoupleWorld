CREATE TABLE world_messages (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  from_nickname TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
