# ERP-0010: Define Retrieval Request and Retry Semantics

Status: Completed
Priority: P0
Category: Architecture, Retrieval, Accounting
Origin Review: v0.5 release audit

## Observation

The v0.5 roadmap requires model-directed recovery, while ADR 0010 prohibits
automatic retries unless a new decision defines their safety and accounting.

## Recommendation

Use an explicit retrieval marker replayed in the next normal client request.
Keep one provider attempt per request and record retry count zero.

## Acceptance Criteria

- The request syntax and client round trip are documented.
- Retrieval cannot trigger an implicit provider retry.
- Hits, misses, injected tokens, and retry count are observable.
- Failures preserve the original request and one-attempt behavior.

## Resolution

Completed by ADR 0014. Implementation is part of the v0.5 retrieval vertical
slice.
