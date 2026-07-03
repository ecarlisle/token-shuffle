# Version history

This document is the succinct, release-level history of Token Shuffle. It
records the purpose and meaningful outcome of each version. The
[changelog](../CHANGELOG.md) tracks individual changes, while the
[roadmap](roadmap.md) describes planned work.

Versions are listed newest first. Update the current entry as its scope becomes
real, then mark it released with a date before opening the next version entry.
For present-tense support status, use the
[capability matrix](capabilities.md); this file remains a historical record.

## v0.6 — Protocol and provider breadth

**Status:** Released as `v0.6.0` on 2026-07-02

v0.6 adds optional native Anthropic Messages ingress and an Anthropic upstream
adapter alongside the existing OpenAI-compatible target. Ingress protocol
capabilities select the adapter without model guessing, translation, retry, or
failover. Provider-specific authentication, streaming events, errors, usage,
and cache-read/cache-creation fields remain intact while lifecycle events retain
their protocol/provider identity.

## v0.5 — Retrieval and externalized context

**Status:** Released as `v0.5.0` on 2026-07-02

v0.5 adds an explicitly enabled local retrieval path:

- compaction sources and large tool/file outputs can become seven-day,
  session-scoped SQLite artifacts;
- artifact and query identities use installation-scoped HMAC-SHA-256;
- schema-v2 migrations preserve existing v0.4 event databases;
- exact artifact identifiers are resolved before bounded FTS5 lexical search;
- a model can emit `token_shuffle_retrieve("query")`, which is fulfilled when
  the client replays that assistant turn in the next request;
- retrieval hits, misses, failures, injected counts, and retry count zero are
  structural evidence without query or artifact content;
- request, session, history deletion, and expiry remove artifacts;
- a full-session fixture remains net-positive after bounded retrieval.

Same-turn tool interception, automatic retrieval retries, embeddings, and
cross-session retrieval are not part of v0.5.

## v0.4 — Conversation compaction

**Status:** Released as `v0.4.0` on 2026-07-01; patched as `v0.4.1` on
2026-07-02

v0.4.1 adds explicit DeepSeek-compatible `developer`-to-`system` dispatch
normalization, repairs clean-checkout workspace package resolution, moves
SQLite initialization to checked-in transactional migrations, and reconciles
the repository documentation with the implemented v0.4 boundary. The default
provider path remains byte-preserving.

v0.4 adds an explicitly enabled deterministic old-turn compactor:

- system and developer instructions remain verbatim;
- a configurable active message window remains verbatim and tool-result
  boundaries are not split;
- older turns become structured objectives, constraints, paths/symbols, changed
  artifacts, failures, decisions, and open questions;
- each summary records source indexes, a deterministic invalidation fingerprint,
  summary version, and explicit uncertainty;
- omitted source remains recoverable for eight hours from bounded process memory
  through the separately authenticated administrative API and never enters
  SQLite;
- compaction applies only when the candidate is smaller than the original;
- source-size limits, the global kill switch, and ineligible inputs fail open;
- deterministic summary creation costs zero model tokens and creates no extra
  provider turn, while accounting still exposes optimization tokens explicitly;
- long-session replay fixtures verify constraint retention, fingerprint changes,
  and positive full-session net reduction.

## v0.3 — First safe transforms

**Status:** Released as `v0.3.0` on 2026-07-01

v0.3 introduces explicitly opted-in deterministic context policies:

- `optimize` mode is separate from byte-preserving `observe` mode;
- tool-output cleanup removes ANSI/non-semantic controls and collapses repeated
  lines while retaining the line and exact repetition count;
- exact redundancy removes only consecutive byte-identical tool-result messages
  carrying the same tool-call ID;
- oversized policy inputs and a global kill switch fail open to the original;
- active decisions, baseline/forwarded counts, optimization work, literal
  reduction, and net reduction are persisted separately;
- dynamic tool-definition selection remains shadow-only with explicit zero
  retry accounting;
- request and session views compare final-boundary net reduction and policy
  retries;
- the deterministic replay harness verifies positive reduction without changing
  accepted semantic fixture content.

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
