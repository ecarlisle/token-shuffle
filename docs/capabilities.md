# Capability status

This matrix answers whether Token Shuffle supports a capability today and what
evidence exists. It complements the [compatibility matrix](compatibility.md),
which records specific client, protocol, provider, model, and version
combinations.

## Status language

- **Validated:** implemented and covered by automated evidence plus any required
  live validation.
- **Implemented:** present in code and automated tests, but not yet validated
  across the relevant live-client combinations.
- **Experimental:** implemented behind explicit opt-in with incomplete quality
  or compatibility evidence.
- **Planned:** accepted roadmap scope that is not implemented.
- **Deferred:** intentionally outside the active roadmap gate.
- **Speculative:** possible later work without an accepted delivery commitment.

## Current stable release: v0.4.0

| Capability | Status | Introduced | Validation | Notes |
| --- | --- | --- | --- | --- |
| Loopback-only authenticated proxy | Validated | v0.1 | [v0.1 release validation](testing/v0.1-release-validation.md) | Agent token is distinct from provider and administrative credentials. |
| OpenAI Chat Completions ingress | Validated | v0.1 | [Compatibility matrix](compatibility.md) | Verified live combinations are OpenCode 1.17.11 and Pi 0.80.3 through OpenCode Zen. |
| Buffered and SSE pass-through | Validated | v0.1 | [v0.1 release validation](testing/v0.1-release-validation.md) | Observe mode preserves request bytes and documented response/SSE semantics. |
| Cancellation, backpressure, and zero automatic retries | Implemented | v0.1 | Proxy integration suite and [ADR 0010](architecture/decisions/0010-execution-and-retry-semantics.md) | Live compatibility evidence is narrower than the protocol suite. |
| Privacy-first SQLite event ledger | Implemented | v0.1 | Storage integration tests | Default events contain structural data, not raw prompts or responses. |
| Administrative evidence dashboard | Implemented | v0.2 | Playwright and dashboard API suites | Includes overview/detail, provenance, diagnostics, live invalidation, and deletion. |
| Deterministic tool-output reduction | Experimental | v0.3 | [v0.3 release validation](testing/v0.3-release-validation.md) | Explicit `optimize` opt-in; live client compatibility remains provisional. |
| Exact redundant tool-result removal | Experimental | v0.3 | [v0.3 release validation](testing/v0.3-release-validation.md) | Restricted to consecutive identical results with the same tool-call ID. |
| Deterministic old-turn compaction | Experimental | v0.4 | [v0.4 release validation](testing/v0.4-release-validation.md) | Explicit opt-in; structured state and a verbatim active window. |
| Memory-only compaction-source recovery | Implemented | v0.4 | [v0.4 release validation](testing/v0.4-release-validation.md) | Bounded, administrative, eight-hour lifetime; cleared by deletion or restart. |

## Accepted future scope

| Capability | Status | Target | Evidence required |
| --- | --- | --- | --- |
| Addressable persistent local artifacts | Planned | v0.5 | Migration, privacy, retention, deletion, and recovery tests |
| SQLite FTS5 lexical retrieval | Planned | v0.5 | Exact-identifier-first selection and retrieval quality fixtures |
| Model recovery path for omitted context | Planned | v0.5 | Retrieval-miss and full-session retry accounting |
| Anthropic Messages ingress | Planned | v0.6 | Separate semantic compatibility contract |
| Multiple upstream adapters and capability negotiation | Planned | v0.6 | Cross-adapter protocol/event suites |
| Tauri workstation distribution | Planned | v0.7 | Signed platform packaging and lifecycle smoke tests |
| Exact response-cache serving | Speculative | Later | Eligibility, side-effect, scope, expiry, and staleness evidence |
| Cost-aware model/provider routing | Speculative | Later | Quality and cost evidence kept separate from token reduction |
| Team aggregation or remote control plane | Deferred | None | Requires an explicit product and privacy decision |

## Reading the matrix

An implementation label is not a broad compatibility promise. A transform can
be implemented and still remain experimental until live agent sessions and
full-session quality evidence support promotion. Likewise, “OpenAI-compatible”
names a protocol family rather than every provider or model in that family.

See the [roadmap](roadmap.md) for evidence gates and
[version history](version-history.md) for release outcomes.
