# Compatibility

Token Shuffle publishes support by tested feature and version. The phrase
“OpenAI-compatible” identifies a protocol family; it does not promise that every
client, provider, field, or model works.

## Status definitions

- **Verified:** automated contract fixtures and a real smoke test pass.
- **Provisional:** fixtures pass but real-provider coverage is incomplete.
- **Unsupported:** known not to work.
- **Unknown:** not tested.
- **Planned:** accepted roadmap scope that has not been implemented.

## Current status

Token Shuffle v0.6.0 has contract-tested OpenAI Chat Completions and Anthropic
Messages implementations.
OpenCode 1.17.11 has completed live traffic through OpenCode Zen with
`deepseek-v4-flash-free`. Pi 0.80.3 subsequently completed a live proxied test
through the same upstream/model. The event ledger increased from eight to eleven
complete request lifecycles without degraded persistence.

| Client | Version | Ingress | Upstream/model | Status |
| --- | --- | --- | --- | --- |
| OpenCode | 1.17.11 | OpenAI Chat Completions | OpenCode Zen / `deepseek-v4-flash-free` | Verified |
| Pi Coding Agent | 0.80.3 | OpenAI Chat Completions | OpenCode Zen / `deepseek-v4-flash-free` | Verified |
| OpenCode | 1.17.11 | OpenAI Chat Completions | OpenAI direct | Provisional |
| Pi Coding Agent | 0.80.3 | OpenAI Chat Completions | OpenAI direct | Provisional |
| OpenCode | — | OpenAI Chat Completions | OpenRouter | Unknown |
| Pi Coding Agent | — | OpenAI Chat Completions | OpenRouter | Unknown |

Specific client versions and a tool-capable model are pinned in v0.1 release
test metadata rather than guessed in advance. Follow the
[v0.1 release-validation checklist](testing/v0.1-release-validation.md).

| Development-slice behavior | Evidence | Status |
| --- | --- | --- |
| Valid buffered Chat Completions request bytes and unknown fields | Fake-provider integration test | Provisional |
| Buffered provider status, body bytes, and selected safe headers | Fake-provider integration test | Provisional |
| Local credential stripping and upstream credential replacement | Fake-provider integration test | Provisional |
| Provider error pass-through | Fake-provider integration test | Provisional |
| Zero automatic retries | Transport-failure integration test | Provisional |
| SSE bytes, event boundaries, backpressure, and cancellation | Fake-provider integration tests | Provisional |
| Observe-mode request byte fidelity after v0.3 | Fake-provider integration test | Provisional |
| Configured `developer` → `system` provider normalization | Fake-provider integration test | Provisional |
| Deterministic optimize-mode context policies | Replay and fake-provider fixtures | Provisional |
| Deterministic old-turn compaction | Replay and fake-provider fixtures | Provisional |
| Session artifacts and FTS5 retrieval | Migration, storage, and fake-provider fixtures | Provisional |
| Next-turn model retrieval marker | Fake-provider and full-session fixtures | Provisional |
| Anthropic Messages buffered/SSE forwarding and cache usage | Fake-provider integration tests | Provisional |

The verified live-client combinations were established in observe mode. v0.3
and v0.4/v0.5 optimize-mode policies are provisional until separate live agent
sessions exercise enabled policies; they do not inherit the observe-mode
verification label.

### DeepSeek developer-role compatibility

Some DeepSeek-compatible providers reject the OpenAI `developer` role. Configure
`upstream.compatibility.developerRole` as `system` to map those roles at the
provider dispatch boundary. The original request remains the source for
structural observation; the outbound payload retains supported roles and all
other message/request fields. This behavior is fixture-tested but remains
provisional until the affected OpenCode/DeepSeek route passes a new live smoke
test. The default `preserve` setting retains byte-level forwarding.

## Feature matrix

Each tested combination records:

- buffered response;
- SSE response;
- tool calls and parallel tool calls;
- developer role;
- image input;
- reasoning fields;
- streaming usage;
- unknown-field preservation;
- provider errors;
- cancellation and backpressure;
- request, header, concurrency, event, and timeout limits.

Same-protocol v0.1 support follows the
[transparent fidelity contract](architecture/decisions/0009-transparent-fidelity-and-compatibility.md).
Future protocol translation publishes semantic mapping guarantees separately.
