CREATE TABLE context_artifacts (
  artifact_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  artifact_kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  content TEXT NOT NULL,
  content_bytes INTEGER NOT NULL
);

CREATE INDEX artifacts_request_idx ON context_artifacts(request_id);
CREATE INDEX artifacts_session_idx ON context_artifacts(session_id);
CREATE INDEX artifacts_expiry_idx ON context_artifacts(expires_at);

CREATE VIRTUAL TABLE context_artifacts_fts USING fts5(
  artifact_id UNINDEXED,
  content,
  content='context_artifacts',
  content_rowid='rowid'
);

CREATE TRIGGER context_artifacts_insert AFTER INSERT ON context_artifacts BEGIN
  INSERT INTO context_artifacts_fts(rowid, artifact_id, content)
  VALUES (new.rowid, new.artifact_id, new.content);
END;

CREATE TRIGGER context_artifacts_delete AFTER DELETE ON context_artifacts BEGIN
  INSERT INTO context_artifacts_fts(context_artifacts_fts, rowid, artifact_id, content)
  VALUES ('delete', old.rowid, old.artifact_id, old.content);
END;

CREATE TRIGGER context_artifacts_update AFTER UPDATE ON context_artifacts BEGIN
  INSERT INTO context_artifacts_fts(context_artifacts_fts, rowid, artifact_id, content)
  VALUES ('delete', old.rowid, old.artifact_id, old.content);
  INSERT INTO context_artifacts_fts(rowid, artifact_id, content)
  VALUES (new.rowid, new.artifact_id, new.content);
END;
