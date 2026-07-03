# ADR 0016: Negotiate adapters by ingress protocol

- Status: Accepted
- Date: 2026-07-02

## Decision

v0.6 keeps the primary OpenAI-compatible target and permits one optional
Anthropic target. `/v1/chat/completions` requires the OpenAI capability;
`/v1/messages` requires the Anthropic Messages capability. Configuration, not
model-name guessing, determines available adapters.

There is no automatic failover or cross-protocol translation. Each adapter
preserves its native request, streaming events, errors, authentication, usage,
and cache-reporting fields. Both produce the shared lifecycle event vocabulary
while retaining protocol and provider identity.

Anthropic ingress is observe-only in v0.6. Existing OpenAI context transforms
are not applied to Anthropic content blocks.
