-- Persist per-user Zentao credentials (encrypted password)
CREATE TABLE IF NOT EXISTS user_zentao_credentials (
  username       TEXT PRIMARY KEY,
  zentao_account TEXT NOT NULL,
  password_enc   TEXT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

