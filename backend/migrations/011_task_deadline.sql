ALTER TABLE local_tasks
  ADD COLUMN IF NOT EXISTS deadline_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_local_tasks_deadline_date ON local_tasks(deadline_date);
