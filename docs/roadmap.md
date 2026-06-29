# Roadmap

Versions are evidence gates, not date promises. A release advances only when its
exit criteria are met.

## v0.0 — Foundation (current)

- Agree on product vocabulary, architecture, privacy, and test strategy.
- Create a strict TypeScript workspace and minimal loopback process.
- Keep inference routes disabled.

Exit: proposed ADRs reviewed; `pnpm check` is green.

## v0.1 — Transparent observer

- OpenAI-compatible Chat Completions ingress and one compatible upstream.
- Correct buffered and SSE pass-through, cancellation, and provider errors.
- Session/request correlation and versioned observation events.
- Token counting with explicit provenance.
- Structural repetition, stable-prefix, cache usage, and latency metrics.
- SQLite persistence with retention and redaction tests.

Exit: byte-preserving fixtures pass; a real supported client completes coding
sessions through the proxy; default storage contains no raw content.

## v0.2 — Evidence dashboard

- Local overview of sessions and provider/model usage.
- Separate token, cache, cost, and latency metrics.
- Request detail with structural breakdown and redacted replay.
- Shadow evaluation of candidate deterministic transforms.

Exit: every displayed number traces to an event and explains its provenance;
the UI never equates cache discounts with tokens avoided.

## v0.3 — First safe transforms

- Opt-in exact-redundancy and stale tool-result policies chosen from v0.1 data.
- Per-policy preview, explanation, limits, and kill switch.
- Baseline-versus-policy replay harness.
- Session-level quality and net-token comparison.

Exit: at least one transform shows repeatable net reduction without regression
on the accepted fixture corpus.

## v0.4 — Conversation compaction

- Model-assisted or deterministic old-turn summaries.
- Optimization-token accounting and summary invalidation.
- Constraint-retention and long-session replay tests.

Exit: compaction is beneficial over full sessions, including the cost to create
summaries and any extra agent turns.

## v0.5 — Protocol and provider breadth

- Anthropic Messages ingress.
- Multiple upstream adapters and provider-aware cache reporting.
- Capability negotiation and compatibility matrix.

Exit: protocol suites prove equivalent domain events without flattening
provider-specific semantics.

## v1.0 — Trustworthy local release

- Installer and upgrade/migration story for macOS, Linux, and Windows.
- Stable configuration/event contracts and documented support matrix.
- Export/import, retention controls, and recovery behavior.
- Performance, privacy, and threat-model review.

Possible later work: retrieval-backed memory, stateful provider continuations,
policy plugins, team aggregation, and cost-aware model routing. None should be
pulled forward merely to broaden the feature list.
