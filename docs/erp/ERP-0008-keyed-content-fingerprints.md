# ERP-0008: Replace Unkeyed Content Fingerprints

Status: Completed
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

Completed for v0.5.

- The proxy derives content identities with HMAC-SHA-256 at the application
  boundary.
- The key resolves from `storage.contentFingerprintKey`; existing
  configurations fall back to the separately environment-resolved local access
  token for backward compatibility.
- Core receives a fingerprint function and fails open without one; it does not
  own or persist secret material.
- Events, structured summaries, recovery routes, and SQLite receive only the
  `hmac-sha256-<64 hex>` identity.
- Existing v0.4 FNV events remain readable history, but their memory-only
  recovery sources cannot survive a restart and the v0.5 recovery route does
  not accept an FNV identifier.
