# ERP-0002: Clarify Capability and Version Truthfulness

Status: Completed
Priority: P0
Category: Documentation, Release Process
Origin Review: Engineering Review v0.4

## Observation

Readers should be able to distinguish implemented capabilities from roadmap items without interpreting scattered version references.

## Evidence

The documentation references multiple milestones and release validation documents. That is valuable, but users need an immediate answer to:

"Does Token Shuffle actually do this today?"

## Recommendation

Create a capability matrix that clearly marks each capability as implemented, validated, experimental, planned, deferred, or speculative.

Suggested file:

- `docs/capabilities.md`

Suggested table:

| Capability | Status | Introduced | Validation | Notes |
| --- | --- | --- | --- | --- |

## Acceptance Criteria

- A reader can identify what v0.4 supports today.
- Roadmap items are not described as implemented capabilities.
- README links to the capability matrix.
- Roadmap and version-history docs use consistent language.
- Validation evidence is referenced where available.

## Files Likely Affected

- `README.md`
- `docs/README.md`
- `docs/capabilities.md`
- `docs/version-history.md`
- `docs/roadmap.md`
- `docs/testing/v0.4-release-validation.md`

## Related ADRs

- ADR-0002: Observe Before Transform
- ADR-0005: Token Optimization Portfolio
- ADR-0009: Transparent Fidelity and Compatibility

## Implementation Notes

Prefer conservative language. If a capability is not proven by code or validation docs, mark it as planned or experimental.

## Self-Review Checklist

- [ ] Are current capabilities clearly separated from future capabilities?
- [ ] Does the README link to the matrix?
- [ ] Are status labels used consistently?
- [ ] Are token-savings claims backed by validation or marked as planned?

## Resolution

Completed for v0.5.

Added a conservative capability matrix with explicit status definitions,
current v0.4 evidence, accepted future scope, validation links, and notes that
separate implementation from live compatibility. README, documentation index,
roadmap, and version history now point readers to the correct source of truth.

Files changed:

- `docs/capabilities.md`
- `README.md`
- `docs/README.md`
- `docs/roadmap.md`
- `docs/version-history.md`
- `docs/erp/ERP-0002-capability-version-truthfulness.md`
- `docs/erp/README.md`

Validation:

- every current capability links to code-derived or release-validation evidence;
- v0.5 retrieval remains planned;
- speculative and deferred work is visibly separate.

Commit: `docs(capabilities): publish truthful support matrix`
Release: v0.5.0
