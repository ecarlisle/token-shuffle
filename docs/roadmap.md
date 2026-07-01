# Roadmap

Versions are evidence gates, not date promises. A release advances only when its
exit criteria are met.

## v0.0 — Foundation (completed)

- Agree on product vocabulary, architecture, privacy, and test strategy.
- Create a strict TypeScript workspace and minimal loopback process.
- Accept the target technology stack and record implementation-alignment work.
- Keep inference routes disabled.

Exit: foundation ADRs reviewed; the TypeScript 6 and Node 24.15 minimum migration
is either completed or explicitly scheduled; `pnpm check` is green.

## v0.1 — Transparent observer (released 2026-06-30)

- Adopt the accepted Node, TypeScript, Fastify, Undici, TypeBox, Pino, and
  development-tooling baseline.
- Implement and contract-test the documented Token Shuffle, OpenCode, and Pi
  getting-started configuration.
- Implement `start`, `status`, `stop`, `config path`, and `config validate`
  commands or update the guide before release if the CLI contract changes.
- Implement `doctor`, mandatory agent-route authentication, local authorization
  stripping, strict versioned JSONC, and loopback/upstream URL policy.
- OpenAI-compatible Chat Completions ingress and one compatible upstream,
  implemented as internal modules rather than premature workspace packages.
- OpenAI direct reference smoke tests followed by provisional OpenRouter tests.
- An execution coordinator separate from Fastify handlers.
- Correct buffered forwarding followed by SSE pass-through, cancellation, and
  provider errors.
- No automatic retries or failover.
- Authoritative request/attempt IDs, explicit or labeled-inferred sessions, and
  versioned observation events.
- Accepted request, header, concurrency, SSE-event, and timeout limits with
  explicit overload errors.
- Token counting with explicit provenance.
- Structural repetition, stable-prefix, cache usage, and latency metrics.
- Tool-definition and tool-output token-share metrics.
- Response-cache eligibility observations without serving cached responses.
- SQLite persistence with retention and redaction tests.
- A dedicated `node:sqlite` worker with explicit SQL migrations and startup
  version/integrity checks.

Exit: transparent fidelity fixtures pass; a real supported client completes
coding sessions against the reference upstream; the compatibility matrix names
tested versions and features; default storage contains no raw content; module
boundaries match the package-map ownership rules.

Implementation complete: Node 24.15/TypeScript 6 alignment, strict JSONC,
authentication and safe network policy, buffered/SSE fidelity, cancellation,
backpressure, identities, structural/token observations, worker-thread SQLite
persistence and retention, CLI lifecycle/diagnostics, explicit limits, and zero
automatic retries.

Release evidence: OpenCode 1.17.11 completed a live session through OpenCode Zen
using `deepseek-v4-flash-free`; Pi 0.80.3 subsequently completed a live proxied
test through the same upstream/model. Complete persisted request lifecycles
increased from eight to eleven without degradation. OpenAI direct remains a
provisional matrix entry and does not inherit these verified results.

## v0.2 — Evidence dashboard (released 2026-07-01)

- React 19.2 and Vite 8 SPA using REST for queries and SSE for live events.
- Implement the documented `open` command and getting-started web UI journey.
- Add single-use browser bootstrap and a separate administrative session before
  exposing history or management APIs.
- TanStack Query, Router, and Table; Radix primitives; Tailwind design tokens;
  Apache ECharts for evidence visualizations.
- Local overview of sessions and provider/model usage.
- Separate token, cache, cost, and latency metrics.
- Request detail with structural breakdown and redacted replay.
- Shadow evaluation of candidate deterministic transforms.

Exit: every displayed number traces to an event and explains its provenance;
the UI never equates cache discounts with tokens avoided.

Implemented:

- single-use CLI bootstrap codes exchanged from URL fragments;
- separate `HttpOnly`, `SameSite=Strict` administrative sessions;
- strict same-origin checks for session mutations;
- read-only overview API with request, session, token, cache, latency, and
  provenance projections;
- request and session detail with ordered event provenance and privacy-safe
  structural replay;
- live SSE invalidation after persisted events;
- separate charts for input, output, cache reads, and literal reduction;
- diagnostics, visible retention settings, and same-origin immediate deletion
  for requests, sessions, or all history;
- explicit non-mutating shadow evaluation of exact redundancy and tool-output
  compaction candidates;
- React/Vite/Tailwind views with responsive loading, empty, error, and
  authenticated states plus Playwright browser coverage;
- built dashboard assets served by the local proxy.

Exit evidence: every displayed total is projected from versioned observation
events; request details expose the contributing lifecycle; cache reads remain
separate from literal token reduction; and automated browser coverage follows
an overview value into redacted structural replay.

## v0.3 — First safe transforms

- Opt-in deterministic tool-output and exact-redundancy policies chosen from
  v0.1 data.
- Shadow evaluation of dynamic tool-definition selection with retry accounting.
- Per-policy preview, explanation, limits, and kill switch.
- Baseline-versus-policy replay harness.
- Session-level quality and net-token comparison.

Exit: at least one transform shows repeatable net reduction without regression
on the accepted fixture corpus.

## v0.4 — Conversation compaction

- Model-assisted or deterministic old-turn summaries.
- Structured compacted state with source ranges and invalidation.
- Optimization-token accounting and summary invalidation.
- Constraint-retention and long-session replay tests.

Exit: compaction is beneficial over full sessions, including the cost to create
summaries and any extra agent turns.

## v0.5 — Retrieval and externalized context

- Addressable local artifacts for full tool outputs, files, and old turns.
- SQLite FTS5 retrieval using exact identifiers before semantic similarity.
- A supported path for the model to request omitted or additional context.
- Retrieval-miss, retry, and full-session token accounting.

Exit: retrieved context improves net session usage on accepted fixtures without
silently preventing recovery of omitted original content.

## v0.6 — Protocol and provider breadth

- Anthropic Messages ingress.
- Multiple upstream adapters and provider-aware cache reporting.
- Capability negotiation and compatibility matrix.
- Extract provider or contract packages only where the second implementation
  proves a stable shared interface.

Exit: protocol suites prove equivalent domain events without flattening
provider-specific semantics.

## v0.7 — Workstation distribution

- Tauri 2 shell with tray and dashboard window.
- Packaged Node proxy sidecar with health supervision.
- Optional launch at login and native credential integration.
- Signed binaries/installers where supported and signed update artifacts for
  macOS, Windows, and Linux.
- Platform smoke tests, crash recovery, and upgrade/rollback exercises.

Exit: installation, proxy operation with the window closed, update verification,
and uninstall behavior pass on every supported platform.

## v1.0 — Trustworthy local release

- Installer and upgrade/migration story for macOS, Linux, and Windows.
- Stable configuration/event contracts and documented support matrix.
- Export/import, retention controls, and recovery behavior.
- Performance, privacy, and threat-model review.

Possible later work: stateful provider continuations, generalized delta
prompting, conservative exact-response caching, policy plugins, team
aggregation, and cost-aware model routing. Routing remains a separate economic
track. None should be pulled forward merely to broaden the feature list.
