-- Daily cached metrics for iteration dashboards

CREATE TABLE IF NOT EXISTS iteration_daily_metrics (
  group_id      INT NOT NULL,
  execution_id  BIGINT NOT NULL,
  day           DATE NOT NULL,
  todo_count    BIGINT NOT NULL DEFAULT 0,
  doing_count   BIGINT NOT NULL DEFAULT 0,
  done_count    BIGINT NOT NULL DEFAULT 0,
  open_estimate FLOAT  NOT NULL DEFAULT 0,
  done_total    BIGINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, execution_id, day)
);

CREATE INDEX IF NOT EXISTS idx_iteration_daily_metrics_exec_day ON iteration_daily_metrics(execution_id, day);
CREATE INDEX IF NOT EXISTS idx_iteration_daily_metrics_group_day ON iteration_daily_metrics(group_id, day);

