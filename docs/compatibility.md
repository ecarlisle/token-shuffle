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

Token Shuffle has a contract-tested buffered development slice. No real provider
or coding-agent smoke test has run, so client/provider combinations remain
planned rather than provisional or verified.

| Client | Ingress | Upstream | Status |
| --- | --- | --- | --- |
| OpenCode | OpenAI Chat Completions | OpenAI direct | Planned for v0.1 |
| Pi Coding Agent | OpenAI Chat Completions | OpenAI direct | Planned for v0.1 |
| OpenCode | OpenAI Chat Completions | OpenRouter | Planned after reference target |
| Pi Coding Agent | OpenAI Chat Completions | OpenRouter | Planned after reference target |

Specific client versions and a tool-capable model are pinned in v0.1 release
test metadata rather than guessed in advance.

| Development-slice behavior | Evidence | Status |
| --- | --- | --- |
| Valid buffered Chat Completions request bytes and unknown fields | Fake-provider integration test | Provisional |
| Buffered provider status, body bytes, and selected safe headers | Fake-provider integration test | Provisional |
| Local credential stripping and upstream credential replacement | Fake-provider integration test | Provisional |
| Provider error pass-through | Fake-provider integration test | Provisional |
| Zero automatic retries | Transport-failure integration test | Provisional |
| SSE streaming | Explicitly rejected | Unsupported in current slice |

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
