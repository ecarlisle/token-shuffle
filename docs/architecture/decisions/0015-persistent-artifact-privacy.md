# ADR 0015: Persistent context artifacts are explicit raw retention

- Status: Accepted
- Date: 2026-07-02

## Context

Retrieval requires readable original context. Structural events deliberately do
not retain prompt or response content, so artifacts need a separate, visible
retention contract rather than inheriting event settings.

## Decision

Persistent artifacts exist only when `policies.retrieval.enabled` is true.
Eligible compacted old turns and full tool outputs are stored in the local
SQLite database with:

- a keyed HMAC-SHA-256 artifact identifier;
- request and session ownership;
- a content kind;
- creation and expiry timestamps;
- a default seven-day retention period.

Artifacts are searched only within the current session. Request, session, and
all-history deletion remove matching artifacts immediately. Expiry pruning
removes artifacts independently of structural-event retention.

Artifact content is raw readable context. The dashboard and documentation must
show its retention separately from raw prompt/response diagnostic capture.
Keys, retrieval queries, and provider credentials are never persisted.

## Consequences

- Retrieval is opt-in because it changes the privacy posture.
- `retainRawContent: false` continues to mean full prompt/response capture is
  disabled; it does not conceal enabled artifact retention.
- Database backups contain artifacts until expiry or deletion and must be
  protected accordingly.
- A future encrypted-at-rest mode requires a separate key-management decision.
