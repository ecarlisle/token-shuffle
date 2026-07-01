CREATE TABLE observation_events (
  event_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  event_json TEXT NOT NULL
);

CREATE INDEX events_request_idx ON observation_events(request_id);
CREATE INDEX events_session_idx ON observation_events(session_id);
CREATE INDEX events_expiry_idx ON observation_events(expires_at);
