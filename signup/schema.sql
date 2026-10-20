CREATE TABLE IF NOT EXISTS signups (
  email      TEXT PRIMARY KEY,
  lang       TEXT,
  list       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
