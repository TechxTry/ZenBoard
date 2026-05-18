-- 个人工作台：外部日历订阅（iCal/ICS URL，服务端拉取并合并展示）
CREATE TABLE IF NOT EXISTS user_calendar_feeds (
  id               BIGSERIAL PRIMARY KEY,
  system_user_id   BIGINT NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  feed_host        TEXT NOT NULL DEFAULT '',
  ical_url_enc     TEXT NOT NULL,
  color            VARCHAR(24) NOT NULL DEFAULT '#6366F1',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_calendar_feeds_user ON user_calendar_feeds(system_user_id);
