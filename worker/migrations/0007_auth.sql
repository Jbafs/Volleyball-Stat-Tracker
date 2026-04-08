-- Admin user accounts and sessions for write-gating the API.
-- Only admin accounts exist; anonymous visitors can view all data
-- and submit proposals but cannot write directly.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,   -- PBKDF2-SHA256, stored as "salt:hash" base64
  role          TEXT NOT NULL DEFAULT 'admin'
                CHECK(role IN ('admin')),
  created_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,   -- 32 random bytes as hex
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,   -- unix ms
  created_at  INTEGER NOT NULL
);

CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
