CREATE TABLE user_items (
  user_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item_name)
);

CREATE TABLE visited_regions (
  couple_key TEXT NOT NULL,
  unit TEXT NOT NULL,
  last_date TEXT,
  title TEXT,
  text TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (couple_key, unit)
);

ALTER TABLE memories ADD COLUMN deleted_at TEXT;
ALTER TABLE mail ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE mail ADD COLUMN deleted_at TEXT;
ALTER TABLE inquiries ADD COLUMN deleted_at TEXT;
