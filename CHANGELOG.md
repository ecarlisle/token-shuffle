# Changelog

This project follows Keep a Changelog conventions while it is pre-release.

## Unreleased

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
