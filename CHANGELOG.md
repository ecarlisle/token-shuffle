# Changelog

This project follows Keep a Changelog conventions while it is pre-release.

## Unreleased

## 0.6.0 - 2026-07-02

### Added

- Optional native Anthropic Messages ingress and Anthropic upstream adapter.
- Protocol-capability selection across coexisting OpenAI-compatible and
  Anthropic targets without translation, retry, or failover.
- Anthropic provider-reported input/output and cache-read/cache-creation
  accounting, kept separate from literal token reduction.
- Versioned observation schema v2 with protocol/provider identity while
  retaining schema-v1 event readability.

### Changed

- Regenerated the workspace lockfile in the declared pnpm 11 format so clean
  `--frozen-lockfile` installs remain reproducible.

## 0.5.0 - 2026-07-02

### Added

- Opt-in, session-scoped persistent artifacts for compacted old turns and large
  tool/file outputs with separate seven-day retention.
- Schema-v2 SQLite migration and exact-ID-first FTS5 lexical retrieval.
- Explicit next-turn `token_shuffle_retrieve("query")` recovery with bounded
  injection, hit/miss/failure evidence, and zero inference retries.
- Dashboard artifact count and retention diagnostics.

### Security

- Replaced persisted unkeyed compaction fingerprints with installation-scoped
  HMAC-SHA-256 identities.

## 0.4.1 - 2026-07-02

### Fixed

- DeepSeek-compatible upstreams can explicitly map unsupported OpenAI
  `developer` messages to `system` at the provider dispatch boundary while
  retaining the original request for observation.
- Clean workspace checkouts now build `@token-shuffle/core` before proxy
  typechecking and resolve its explicit JavaScript and declaration entry points.
- CI now verifies the full frozen-install, check, build, and test sequence.

### Changed

- SQLite schema initialization now uses ordered, checked-in transactional
  migrations and preserves existing v0.4 event databases.
- Repository navigation, capability claims, request-flow documentation, and
  contributor guidance now reflect the completed v0.4 implementation.

## 0.4.0 - 2026-07-01

### Added

- Opt-in deterministic conversation compaction with structured retained state,
  source ranges, versioned fingerprints, and explicit uncertainty.
- Verbatim system/developer messages, configurable active windows, and
  tool-boundary protection.
- Fail-open source limits, no-benefit rejection, and invalidation replay tests.
- Bounded eight-hour memory-only source recovery with administrative access and
  request/session/history deletion integration.
- Full-session net-token and constraint-retention release fixtures.

## 0.3.0 - 2026-07-01

### Added

- Explicit `optimize` mode with opt-in deterministic tool-output cleanup and
  exact-redundancy policies.
- Global policy kill switch, bounded fail-open policy input, versioned decision
  events, and final-boundary token accounting.
- Baseline-versus-policy replay fixtures and session-level net-token/retry
  evidence.
- Shadow-only dynamic tool-definition selection with explicit retry accounting.

## 0.2.0 - 2026-07-01

### Added

- Verified Pi Coding Agent 0.80.3 compatibility with OpenCode Zen through a
  live proxied session.
- Single-use dashboard bootstrap authentication and separate administrative
  cookies.
- Event-backed overview, request/session detail, structural replay, diagnostics,
  retention visibility, and immediate evidence deletion.
- Live SSE dashboard invalidation and category-preserving token charts.
- Deterministic shadow evaluation for exact redundancy and tool-output
  compaction candidates without mutating inference traffic.
- Automated browser coverage for evidence provenance and redaction.

## 0.1.0 - 2026-06-30

### Added

- Initial product, architecture, testing, and roadmap documentation.
- Accepted the token-optimization portfolio, priorities, and accounting
  boundaries.
- Accepted evolutionary package boundaries and an execution-coordinator
  architecture.
- Accepted the full production technology stack and Tauri workstation
  distribution strategy.
- Added an orderly documentation index and planned user onboarding for Token
  Shuffle, OpenCode, Pi Coding Agent, and the web UI.
- Accepted observe-first scope, OpenAI-compatible ingress, privacy retention,
  and strict local authentication/configuration decisions.
- Accepted transparent fidelity, compatibility targets, no-retry execution,
  event/session identity, and resource-limit decisions.
- Added repository-wide coding-agent guardrails aligned with accepted ADRs.
- TypeScript workspace with a minimal local-only status endpoint.
- Provider-neutral token-impact accounting with unit tests.
- Aligned the workspace with Node.js 24.15+ and TypeScript 6.
- Added strict JSONC configuration with environment-resolved secrets and safe
  loopback/upstream URL enforcement.
- Added authenticated, byte-preserving buffered Chat Completions forwarding to
  one OpenAI-compatible upstream, with explicit limits and no retries.
- Added a succinct release-level version history for the current and subsequent
  versions.
- Completed the v0.1 transparent-observer implementation with SSE forwarding,
  lifecycle identities, provenance-aware structural measurements, worker-thread
  SQLite retention, and headless lifecycle/diagnostic CLI commands.
