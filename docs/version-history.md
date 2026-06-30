# Version history

This document is the succinct, release-level history of Token Shuffle. It
records the purpose and meaningful outcome of each version. The
[changelog](../CHANGELOG.md) tracks individual changes, while the
[roadmap](roadmap.md) describes planned work.

Versions are listed newest first. Update the current entry as its scope becomes
real, then mark it released with a date before opening the next version entry.

## v0.1 — Transparent observer

**Status:** Release candidate (`v0.1.0-rc.1`)

Token Shuffle began forwarding inference traffic through an authenticated local
proxy. The initial vertical slice provides:

- strict JSONC configuration with environment-resolved secrets;
- loopback-only binding and safe upstream URL validation;
- one OpenAI-compatible Chat Completions upstream;
- byte-preserving buffered and SSE request/response forwarding with
  backpressure;
- local credential replacement, explicit resource limits, cancellation, and no
  automatic retries;
- request, attempt, event, and explicit/inferred session identities;
- structural repetition, stable-prefix, tool-share, cache, usage, and latency
  observations with explicit count provenance;
- worker-thread SQLite event persistence, retention, deletion, startup
  integrity checks, and degraded-persistence accounting;
- `start`, `stop`, `status`, `config path`, `config validate`, and `doctor`
  commands;
- Node.js 24.15+, TypeScript 6, protocol integration tests, and synchronized
  user documentation.

Implementation is complete. Real OpenAI smoke tests and live OpenCode/Pi coding
sessions remain release-validation gates because this workstation has no
configured provider credential. The dashboard is v0.2 scope. This entry does
not yet represent a final v0.1 release.

## v0.0 — Foundation

**Status:** Completed foundation

Established the product vision, token-savings accounting, privacy and security
principles, compatibility guarantees, architecture boundaries, technology
stack, testing strategy, roadmap, and contributor workflow. Added the initial
TypeScript workspace, loopback status process, and provider-neutral token-impact
accounting.
