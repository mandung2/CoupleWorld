-- 처음부터 있던 기본 테이블 (0001 이전에 대시보드에서 직접 만든 것).
-- 새 DB를 저장소만으로 다시 만들 수 있도록 남겨둡니다. 운영 DB에는 이미 있어서
-- IF NOT EXISTS 때문에 아무 일도 하지 않습니다.
-- 뒤 마이그레이션에서 ALTER로 추가하는 열(points, avatar, photo, status 등)은 여기 넣지 않습니다.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL UNIQUE,
  gender TEXT NOT NULL,
  birth TEXT NOT NULL,
  partner_id TEXT,
  start_date TEXT,
  linked INTEGER NOT NULL DEFAULT 0,
  session_token TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  suspended INTEGER NOT NULL DEFAULT 0,
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS mail (
  id TEXT PRIMARY KEY,
  to_id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  from_nickname TEXT NOT NULL,
  start_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL DEFAULT 'couple_request',
  title TEXT,
  body TEXT
);

CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '답변대기',
  reply TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id TEXT
);

CREATE TABLE IF NOT EXISTS shop_items (
  item_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sold INTEGER NOT NULL DEFAULT 0,
  revenue INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL DEFAULT 0
);
