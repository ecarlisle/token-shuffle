# Roadmap

Versions are evidence gates, not date promises. A release advances only when its
exit criteria are met.

## v0.0 — Foundation (current)

- Agree on product vocabulary, architecture, privacy, and test strategy.
- Create a strict TypeScript workspace and minimal loopback process.
- Keep inference routes disabled.

Exit: proposed ADRs reviewed; `pnpm check` is green.

## v0.1 — Transparent observer

- OpenAI-compatible Chat Completions ingress and one compatible upstream,
  implemented as internal modules rather than premature workspace packages.
- An execution coordinator separate from Fastify handlers.
- Correct buffered forwarding followed by SSE pass-through, cancellation, and
  provider errors.
- Session/request correlation and versioned observation events.
- Token counting with explicit provenance.
- Structural repetition, stable-prefix, cache usage, and latency metrics.
- Tool-definition and tool-output token-share metrics.
- Response-cache eligibility observations without serving cached responses.
- SQLite persistence with retention and redaction tests.

Exit: byte-preserving fixtures pass; a real supported client completes coding
sessions through the proxy; default storage contains no raw content; module
boundaries match the package-map ownership rules.

## v0.2 — Evidence dashboard

- Local overview of sessions and provider/model usage.
- Separate token, cache, cost, and latency metrics.
- Request detail with structural breakdown and redacted replay.
- Shadow evaluation of candidate deterministic transforms.

Exit: every displayed number traces to an event and explains its provenance;
the UI never equates cache discounts with tokens avoided.

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
- Hybrid retrieval using exact identifiers before semantic similarity.
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

## v1.0 — Trustworthy local release

- Installer and upgrade/migration story for macOS, Linux, and Windows.
- Stable configuration/event contracts and documented support matrix.
- Export/import, retention controls, and recovery behavior.
- Performance, privacy, and threat-model review.

Possible later work: stateful provider continuations, generalized delta
prompting, conservative exact-response caching, policy plugins, team
aggregation, and cost-aware model routing. Routing remains a separate economic
track. None should be pulled forward merely to broaden the feature list.
