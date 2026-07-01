# ERP-0008: Replace Unkeyed Content Fingerprints

Status: Accepted
Priority: P0
Category: Security, Privacy, Architecture
Origin Review: ERP-0005 architecture consistency audit

## Observation

v0.4 compaction persists an FNV-1a fingerprint derived from raw compacted
messages. Accepted privacy architecture requires keyed content fingerprints.

## Risk

An unkeyed deterministic fingerprint can support offline guessing of likely
content and does not provide the scoped identity required for durable v0.5
artifacts.

## Recommendation

Introduce a per-installation secret key referenced from configuration and use
HMAC-SHA-256 at the proxy boundary. Core compaction should return source
material/ranges without owning a secret. Persist only the scoped HMAC
fingerprint.

## Acceptance Criteria

- No unkeyed raw-content fingerprint enters events or SQLite.
- The key is environment-resolved and never logged or persisted.
- Comparison and route validation use the new fingerprint format.
- Existing v0.4 recovery behavior remains bounded and deletable.
- Migration/compatibility behavior for existing events is documented.

## Resolution

Accepted for v0.5 because persistent artifact identity depends on this privacy
boundary. Implementation pending.
