# ERP-0009: Establish Versioned Storage Migrations

Status: Accepted
Priority: P0
Category: Storage, Architecture, Release Engineering
Origin Review: ERP-0005 architecture consistency audit

## Observation

The v0.4 event store creates schema version 1 from inline worker-source SQL.
There are no checked-in migration files or tested upgrade path.

## Risk

v0.5 artifacts and FTS5 require schema changes. Extending inline initialization
would make upgrades, rollback diagnosis, and schema review fragile.

## Recommendation

Create ordered, checked-in SQL migrations owned by the local store. Apply them
transactionally in the SQLite worker and test a real v0.4-to-v0.5 upgrade.

## Acceptance Criteria

- Migration SQL is checked in and ordered.
- Startup applies each migration transactionally.
- Newer unsupported schemas fail visibly.
- Fresh database and v0.4 upgrade tests pass.
- Integrity, retention, and request/session deletion remain correct.

## Resolution

Accepted as a prerequisite for v0.5 persistent artifacts and FTS5.
Implementation pending.
