CREATE TABLE rate_limit_counters (
  scope TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK(request_count >= 1),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(scope, key_hash, window_start)
);

CREATE INDEX idx_rate_limit_updated_at
ON rate_limit_counters(updated_at);
