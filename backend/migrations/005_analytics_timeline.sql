-- Timeline tables & structured timestamps for analytics dashboards

-- ---- Tasks: add key timestamps (for CFD/burndown/cycle-time approximations) ----
ALTER TABLE local_tasks
  ADD COLUMN IF NOT EXISTS opened_date   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_date  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_date   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_local_tasks_opened_date   ON local_tasks(opened_date);
CREATE INDEX IF NOT EXISTS idx_local_tasks_started_date  ON local_tasks(started_date);
CREATE INDEX IF NOT EXISTS idx_local_tasks_finished_date ON local_tasks(finished_date);
CREATE INDEX IF NOT EXISTS idx_local_tasks_closed_date   ON local_tasks(closed_date);

-- ---- Stories ----
ALTER TABLE local_stories
  ADD COLUMN IF NOT EXISTS opened_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_local_stories_opened_date ON local_stories(opened_date);
CREATE INDEX IF NOT EXISTS idx_local_stories_closed_date ON local_stories(closed_date);

-- ---- Bugs ----
ALTER TABLE local_bugs
  ADD COLUMN IF NOT EXISTS opened_date   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_date   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_local_bugs_opened_date   ON local_bugs(opened_date);
CREATE INDEX IF NOT EXISTS idx_local_bugs_resolved_date ON local_bugs(resolved_date);
CREATE INDEX IF NOT EXISTS idx_local_bugs_closed_date   ON local_bugs(closed_date);

-- ---- Action log (zt_action) ----
CREATE TABLE IF NOT EXISTS local_actions (
  id          BIGINT PRIMARY KEY,
  object_type VARCHAR(30),
  object_id   BIGINT,
  actor       VARCHAR(60),
  action      VARCHAR(60),
  action_date TIMESTAMPTZ,
  comment     TEXT,
  extra       TEXT,
  deleted     BOOLEAN     NOT NULL DEFAULT FALSE,
  raw_data    JSONB,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_local_actions_object ON local_actions(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_local_actions_date   ON local_actions(action_date);
CREATE INDEX IF NOT EXISTS idx_local_actions_actor  ON local_actions(actor);

-- ---- Field history (zt_history) ----
CREATE TABLE IF NOT EXISTS local_histories (
  id        BIGINT PRIMARY KEY,
  action_id BIGINT,
  field     VARCHAR(60),
  old       TEXT,
  new       TEXT,
  diff      TEXT,
  raw_data  JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_local_histories_action ON local_histories(action_id);
CREATE INDEX IF NOT EXISTS idx_local_histories_field  ON local_histories(field);

