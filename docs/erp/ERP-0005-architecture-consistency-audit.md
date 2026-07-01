# ERP-0005: Audit Architecture Documentation Against Implementation

Status: Completed
Priority: P1  
Category: Architecture, Documentation, Code Consistency  
Origin Review: Engineering Review v0.4

## Observation

Architecture documentation should remain aligned with implementation as the repository evolves.

## Evidence

The project now includes enough code and documentation that mismatches may emerge over time. A recurring audit will help avoid architecture theater.

## Recommendation

Compare architecture documents against the current implementation.

Review:

- package map
- architecture overview
- ADRs
- source topology
- public entrypoints
- execution pipeline
- provider implementation
- storage implementation
- dashboard projection

Update documentation where the implementation has evolved.

Do not change implementation unless a documentation mismatch reveals an actual bug.

## Acceptance Criteria

- Architecture docs accurately describe the current repository.
- Outdated package or flow descriptions are corrected.
- Future capabilities are labeled as future.
- Any unresolved mismatch is documented as follow-up work.

## Files Likely Affected

- `docs/architecture/overview.md`
- `docs/architecture/package-map.md`
- `docs/architecture/technology-stack.md`
- `docs/architecture/decisions/*.md`
- `apps/proxy/src/**`
- `apps/web/src/**`
- `packages/core/src/**`

## Related ADRs

- ADR-0001: TypeScript Node
- ADR-0003: OpenAI-Compatible First
- ADR-0006: Evolutionary Package Boundaries
- ADR-0010: Execution and Retry Semantics
- ADR-0011: Event and Session Identity
- ADR-0012: Resource and Timeout Limits

## Implementation Notes

If the audit finds uncertainty, document it instead of guessing.

## Self-Review Checklist

- [ ] Does architecture documentation match code?
- [ ] Are package boundaries current?
- [ ] Are execution flows accurate?
- [ ] Are future concepts labeled as future?
- [ ] Are unresolved gaps recorded?

## Resolution

Completed for v0.5.

The audit compared source topology, package manifests, coordinator behavior,
storage SQL, dashboard boundaries, and public entry points against architecture
documents. Current behavior is now separated from target-state route planning,
cache, failover, persistent artifacts, OpenAPI generation, migrations, and
tooling.

New architectural work was recorded instead of implemented speculatively:

- ERP-0008: replace unkeyed compaction fingerprints;
- ERP-0009: establish checked-in transactional storage migrations.

Files changed:

- `docs/architecture/overview.md`
- `docs/architecture/package-map.md`
- `docs/architecture/technology-stack.md`
- `docs/erp/ERP-0005-architecture-consistency-audit.md`
- `docs/erp/ERP-0008-keyed-content-fingerprints.md`
- `docs/erp/ERP-0009-versioned-storage-migrations.md`
- `docs/erp/README.md`

Validation:

- implemented and planned flows are labeled;
- technology adoption gaps are explicit;
- unresolved privacy/storage mismatches have accepted v0.5 packets.

Commit: `docs(architecture): reconcile implementation and target state`
Release: v0.5.0
