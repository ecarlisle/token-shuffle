# ADR 0010: Execution and retry semantics

- Status: Accepted
- Date: 2026-06-29

## Context

An automatic retry can duplicate provider cost, output, or a model-generated
tool call. Once request bytes may have reached a provider, absence of a response
does not prove that the inference was not processed. Retrying because local
measurement or persistence failed would be especially misleading.

## Decision

v0.1 performs no automatic inference retries or failover.

The execution coordinator records these conceptual states:

```text
received
  -> authenticated
  -> prepared
  -> dispatched
  -> response_committed
  -> completed
```

An attempt may instead become `failed` or `cancelled`, with its last confirmed
state recorded. Response commitment occurs when Token Shuffle commits upstream
status and headers to the client.

Rules:

- propagate upstream authentication, rate-limit, and server errors;
- propagate client cancellation upstream promptly;
- never retry after response commitment;
- never retry because measurement, event persistence, or dashboard projection
  failed;
- do not disguise a provider error as a Token Shuffle error;
- stopping Token Shuffle aborts active requests without restarting them;
- record whether the attempt was dispatched, committed, completed, failed, or
  cancelled.

Any future retry or failover feature requires a new ADR defining eligible error
classes, idempotency evidence, attempt accounting, limits, and user visibility.

## Consequences

- Some transient failures that another gateway might hide remain visible.
- Cost and tool-call duplication are avoided by default.
- v0.1 has one attempt per request.
- The state machine and cancellation behavior require integration tests.
- Later multi-provider routing does not imply automatic failover.
