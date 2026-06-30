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

Token Shuffle is v0.0. Inference compatibility is not implemented.

| Client | Ingress | Upstream | Status |
| --- | --- | --- | --- |
| OpenCode | OpenAI Chat Completions | OpenAI direct | Planned for v0.1 |
| Pi Coding Agent | OpenAI Chat Completions | OpenAI direct | Planned for v0.1 |
| OpenCode | OpenAI Chat Completions | OpenRouter | Planned after reference target |
| Pi Coding Agent | OpenAI Chat Completions | OpenRouter | Planned after reference target |

Specific client versions and a tool-capable model are pinned in v0.1 release
test metadata rather than guessed in advance.

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
