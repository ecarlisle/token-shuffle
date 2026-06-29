# ADR 0003: Begin with OpenAI-compatible ingress

- Status: Proposed
- Date: 2026-06-29

## Context

Agent clients and providers expose overlapping but non-identical protocols.
Trying to normalize all of them immediately would obscure streaming correctness
and make testing combinatorial.

## Decision

Implement OpenAI-compatible Chat Completions ingress and SSE pass-through first,
with one OpenAI-compatible upstream adapter. Preserve unknown fields whenever
possible. Add Anthropic Messages ingress after the event and streaming contracts
are stable. Treat newer stateful APIs as separate adapters, not assumptions in
the core domain.

## Consequences

- The first vertical slice is narrow enough to test deeply.
- Some named clients will require compatibility configuration or wait for a
  later protocol adapter.
- Provider-specific cache metadata remains at adapter boundaries.
