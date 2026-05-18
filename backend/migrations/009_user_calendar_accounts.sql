-- 个人工作台：日历账户（Exchange / CalDAV）
-- 仅存储连接信息与加密后的密码；后续可用于拉取日程并合并到工作台日历视图。
CREATE TABLE IF NOT EXISTS user_calendar_accounts (
  id               BIGSERIAL PRIMARY KEY,
  system_user_id   BIGINT NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  type             VARCHAR(20) NOT NULL, -- exchange | caldav
  server           TEXT NOT NULL DEFAULT '', -- CalDAV server host/url；Exchange 可为空
  username         TEXT NOT NULL, -- 邮箱/用户名
  password_enc     TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_calendar_accounts_user ON user_calendar_accounts(system_user_id);
CREATE INDEX IF NOT EXISTS idx_user_calendar_accounts_type ON user_calendar_accounts(type);
