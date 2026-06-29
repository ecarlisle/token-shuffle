# ADR 0004: Local SQLite with privacy-first events

- Status: Proposed
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

## Consequences

- Default analytics can detect repetition without retaining readable content.
- Full replay requires explicit capture and redaction.
- Schema migrations and retention deletion need integration tests.
- WAL safety and SQLite library version become release concerns.
