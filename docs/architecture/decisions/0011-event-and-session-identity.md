# ADR 0011: Event and session identity

- Status: Accepted
- Date: 2026-06-29

## Context

Request-level accounting must remain trustworthy even when a generic
OpenAI-compatible client provides no durable conversation identifier. Heuristic
session grouping is useful in the dashboard but cannot safely control deletion,
retention, authorization, or savings attribution without disclosing its
uncertainty.

Database rows are also an implementation detail and should not become the
versioned event contract.

## Decision

Assign every accepted request an opaque Token Shuffle request ID and every
provider attempt a distinct attempt ID. Event IDs are independently unique and
events carry an explicit schema version.

Session association uses this priority:

1. a validated `X-Token-Shuffle-Session-Id` supplied by an integrated client;
2. another verified client identifier documented in the compatibility matrix;
3. an explicit user-created diagnostic capture session;
4. time/client/project heuristics.

Client-supplied internal headers are consumed locally and not forwarded.
Unverified grouping is labeled `inferred` with its method. Request and attempt
records remain authoritative.

The initial event vocabulary includes:

- `request.received`;
- `request.measured`;
- `route.selected`;
- `attempt.started`;
- `attempt.first_byte`;
- `attempt.usage`;
- `attempt.completed`;
- `attempt.failed`;
- `request.cancelled`;
- `request.completed`;
- `persistence.degraded`.

Events include timestamps, monotonic durations where applicable, identifiers,
client/protocol, provider/model, measurement provenance, redacted decisions,
retention state, and classified errors. Event schemas are independent of SQLite
row layouts and dashboard projections.

Heuristic sessions cannot grant authority, extend retention, prevent
request-level deletion, or convert estimated session totals into authoritative
measurements.

## Consequences

- The dashboard can group requests while showing uncertainty honestly.
- Client integrations can improve grouping without changing core accounting.
- Request-level deletion remains possible regardless of session inference.
- Event schema evolution and database migration are related but separate tests.
- IDs and session headers must be bounded, validated, redacted where necessary,
  and included in protocol fixtures.
