# ADR 0004: Local SQLite with privacy-first events

- Status: Accepted
- Date: 2026-06-29

## Context

The dashboard and replay system need durable local observations. Coding-agent
traffic can contain source code, credentials, personal data, and proprietary
prompts.

## Decision

Use a versioned event schema persisted in local SQLite. Store structural metrics,
timings, policy decisions, and keyed hashes by default. Raw body capture is off,
bounded by retention settings when enabled, and visibly indicated in the UI.
Never store provider credentials.

Initial retention defaults are:

- readable prompts and responses: not retained;
- structural request and execution events: 30 days;
- redacted error events: 14 days;
- aggregate projections: retained until the user deletes them;
- diagnostic raw capture: explicit, scoped, visibly active, and automatically
  expiring.

Cache retention is a separate policy and cannot inherit event-retention defaults
implicitly.

## Consequences

- Default analytics can detect repetition without retaining readable content.
- Full replay requires explicit capture and redaction.
- Schema migrations and retention deletion need integration tests.
- WAL safety and SQLite library version become release concerns.
- The product must provide deletion by session and deletion of all local data.
- Heuristic session grouping cannot weaken request-level deletion.
