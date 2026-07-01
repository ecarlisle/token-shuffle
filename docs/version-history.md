# Version history

This document is the succinct, release-level history of Token Shuffle. It
records the purpose and meaningful outcome of each version. The
[changelog](../CHANGELOG.md) tracks individual changes, while the
[roadmap](roadmap.md) describes planned work.

Versions are listed newest first. Update the current entry as its scope becomes
real, then mark it released with a date before opening the next version entry.

## v0.2 — Evidence dashboard

**Status:** Released as `v0.2.0` on 2026-07-01

v0.2 adds a separate administrative security boundary and a local evidence
dashboard:

- `token-shuffle open` creates a two-minute, single-use bootstrap code and keeps
  it in the browser URL fragment;
- successful exchange creates an eight-hour `HttpOnly`, `SameSite=Strict`
  administrative cookie;
- the agent bearer token cannot read dashboard history;
- the overview keeps input, output, literal reduction, provider cache reads,
  latency, and count provenance separate;
- request and session details trace measurements to ordered persisted events;
- structural replay explains baseline, forwarding, and optimization work without
  reconstructing raw content;
- live persisted events invalidate dashboard queries through SSE;
- token charts preserve accounting categories rather than combining them;
- diagnostics expose non-secret runtime and retention settings;
- request, session, and complete-history deletion require the administrative
  cookie and strict same-origin checks;
- deterministic shadow-policy events record candidate eligibility without
  mutating traffic or claiming unrealized savings;
- Playwright verifies the overview-to-detail provenance journey.

## v0.1 — Transparent observer

**Status:** Released as `v0.1.0` on 2026-06-30

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

Release validation used OpenCode 1.17.11 with OpenCode Zen and
`deepseek-v4-flash-free`, followed by Pi 0.80.3 through the same
upstream/model. The local event ledger increased from eight to eleven complete
request lifecycles without degraded persistence. OpenAI direct and other
client/upstream combinations remain provisional rather than inheriting the
verified status. The dashboard is v0.2 scope.

## v0.0 — Foundation

**Status:** Completed foundation

Established the product vision, token-savings accounting, privacy and security
principles, compatibility guarantees, architecture boundaries, technology
stack, testing strategy, roadmap, and contributor workflow. Added the initial
TypeScript workspace, loopback status process, and provider-neutral token-impact
accounting.
