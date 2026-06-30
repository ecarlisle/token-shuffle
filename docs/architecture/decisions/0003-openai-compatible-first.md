# ADR 0003: Begin with OpenAI-compatible ingress

- Status: Accepted
- Date: 2026-06-29

## Context

Agent clients and providers expose overlapping but non-identical protocols.
Trying to normalize all of them immediately would obscure streaming correctness
and make testing combinatorial.

## Decision

Implement one deeply tested vertical slice:

- OpenAI-compatible `POST /v1/chat/completions` ingress;
- buffered JSON and SSE responses;
- tool calls, provider errors, usage events, backpressure, and cancellation;
- OpenCode and Pi as initial client compatibility targets;
- one generic OpenAI-compatible upstream adapter;
- one named real upstream used for release smoke tests.

Preserve unknown fields whenever possible. Add Anthropic Messages ingress after
the event and streaming contracts are stable. Treat Responses and other stateful
APIs as separate adapters, not assumptions in the core domain.

## Consequences

- The first vertical slice is narrow enough to test deeply.
- Some named clients will require compatibility configuration or wait for a
  later protocol adapter.
- Provider-specific cache metadata remains at adapter boundaries.
- v0.1 does not include active transformations, dynamic routing, response-cache
  serving, Anthropic ingress, or generalized protocol translation.
- “OpenAI-compatible” alone is not a support claim; the compatibility matrix
  names tested clients, providers, models, features, and versions.
