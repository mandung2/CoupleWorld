CREATE TABLE quest_completions (
  user_id TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, quest_id)
);
