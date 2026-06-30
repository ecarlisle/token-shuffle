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

Token Shuffle v0.1.0 has a contract-tested buffered and SSE implementation.
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
