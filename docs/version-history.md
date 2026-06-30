# Version history

This document is the succinct, release-level history of Token Shuffle. It
records the purpose and meaningful outcome of each version. The
[changelog](../CHANGELOG.md) tracks individual changes, while the
[roadmap](roadmap.md) describes planned work.

Versions are listed newest first. Update the current entry as its scope becomes
real, then mark it released with a date before opening the next version entry.

## v0.1 — Transparent observer

**Status:** In development

Token Shuffle began forwarding inference traffic through an authenticated local
proxy. The initial vertical slice provides:

- strict JSONC configuration with environment-resolved secrets;
- loopback-only binding and safe upstream URL validation;
- one OpenAI-compatible Chat Completions upstream;
- byte-preserving buffered request and response forwarding;
- local credential replacement, explicit resource limits, cancellation, and no
  automatic retries;
- Node.js 24.15+, TypeScript 6, protocol integration tests, and synchronized
  user documentation.

Streaming, measurement, persistence, CLI lifecycle commands, real-provider
smoke tests, coding-agent verification, and the dashboard remain unfinished.
This entry does not represent a v0.1 release.

## v0.0 — Foundation

**Status:** Completed foundation

Established the product vision, token-savings accounting, privacy and security
principles, compatibility guarantees, architecture boundaries, technology
stack, testing strategy, roadmap, and contributor workflow. Added the initial
TypeScript workspace, loopback status process, and provider-neutral token-impact
accounting.
