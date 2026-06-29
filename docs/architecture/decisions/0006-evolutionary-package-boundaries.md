# ADR 0006: Evolutionary package boundaries

- Status: Accepted
- Date: 2026-06-29

## Context

An earlier design assigned contracts, context, routing, providers, caching,
events, configuration, gateway, CLI, and dashboard to separate packages before
their interfaces had been implemented. Its conceptual responsibilities were
useful, but physical packages would prematurely freeze speculative boundaries.
It also made routing depend on context preparation and placed orchestration in a
gateway that was otherwise prohibited from containing business logic.

## Decision

Adopt the ownership rules and extraction triggers in the
[package and module map](../package-map.md).

Specifically:

1. Keep the initial physical workspace at `packages/core`, `apps/proxy`, and
   `apps/web`.
2. Enforce gateway, coordinator, protocol, provider, storage, and context
   boundaries as internal modules first.
3. Put runtime sequencing, retries, failover, and streaming lifecycle in an
   execution coordinator.
4. Keep route planning and context preparation independent; the coordinator
   prepares context for each candidate.
5. Keep wire schemas, domain concepts, provider representations, event schemas,
   and persistence records distinct.
6. Use one local-store owner for events, artifacts, cache records, projections,
   migrations, and retention.
7. Separate event persistence from accounting, projection, and replay logic.
8. Extract a package only after its documented trigger is met.
9. Do not introduce a general-purpose `common` package.
10. Build vertical slices rather than completing layers in isolation.

## Consequences

- Early navigation remains simple while logical ownership is explicit.
- Some internal modules will move later, but extraction will be evidence-based.
- The execution coordinator becomes an important application seam with dedicated
  integration tests.
- Failover can correctly rebuild context for a target with different
  capabilities.
- Provider-specific semantics can be retained without polluting core rules.
- Package creation requires a meaningful consumer or operational boundary, not
  merely a distinct architectural noun.
