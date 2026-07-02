# Request-flow walkthroughs

These walkthroughs explain implemented v0.4 behavior without requiring source
code knowledge. Planned v0.5 retrieval is separated at the end.

## Startup

```text
CLI -> load and validate JSONC -> resolve environment secrets
    -> open SQLite worker -> migrate/check/prune
    -> build Fastify app -> bind explicit loopback address
```

1. The CLI resolves the selected configuration path.
2. Configuration validation rejects unknown keys, missing environment secrets,
   unsafe bindings, and unsafe upstream URLs.
3. The SQLite worker checks its version and integrity, applies the current
   schema, and prunes expired events.
4. The composition root constructs the provider adapter, execution coordinator,
   event sink, dashboard API, and static dashboard serving.
5. Fastify binds only to the configured `127.0.0.1` port.

No provider inference occurs during startup. See
[ADR 0008](decisions/0008-local-authentication-and-configuration.md) and
[ADR 0012](decisions/0012-resource-and-timeout-limits.md).

## Observe-mode inference

```text
agent -> Fastify ingress -> authorization/limits/validation
      -> execution coordinator -> original request bytes
      -> OpenAI-compatible provider -> buffered body or SSE
      -> agent

coordinator -> versioned structural events -> resilient sink -> SQLite worker
```

1. Fastify enforces body/header limits and validates the local bearer token.
2. The protocol boundary retains both the valid raw JSON bytes and a parsed
   measurement view.
3. The coordinator assigns request, attempt, event, and session identities.
4. Measurement and shadow-policy decisions inspect the parsed view.
5. Because mode is `observe`, the provider receives the original body bytes.
6. Local authorization and internal headers are removed; the adapter attaches
   the separately configured upstream credential.
7. Buffered responses preserve status/body bytes; SSE preserves event order,
   names, data, boundaries, backpressure, and cancellation.
8. No inference retry or failover is attempted.
9. Structural events persist asynchronously. Persistence degradation never
   causes a duplicate inference.

See [ADR 0009](decisions/0009-transparent-fidelity-and-compatibility.md) and
[ADR 0010](decisions/0010-execution-and-retry-semantics.md).

## Optimize-mode inference

```text
validated baseline
  -> ordered immutable policies
  -> unchanged? original bytes : prepared JSON bytes
  -> one provider attempt
  -> final-boundary token impact and policy events
```

1. The same raw baseline and parsed view enter the coordinator.
2. Explicitly enabled policies run in order; the global kill switch bypasses
   all of them.
3. A policy returns a new value and decision record rather than mutating the
   baseline.
4. If nothing changes, original bytes are forwarded. If a policy applies, only
   the prepared request is serialized and forwarded.
5. Savings are calculated once from baseline versus final forwarded input.
   Individual policy decisions are explanatory and are not summed.
6. v0.4 compaction retains bounded source in process memory for administrative
   recovery; it does not write raw source to SQLite or expose it to the model.
7. Transform uncertainty or configured limits preserve the original request.

See [ADR 0002](decisions/0002-observe-before-transform.md),
[ADR 0005](decisions/0005-token-optimization-portfolio.md), and the
[v0.4 release validation](../testing/v0.4-release-validation.md).

## Dashboard authentication and updates

```text
CLI open -> single-use fragment code -> POST /api/admin/session
         -> HttpOnly administrative cookie

persisted event -> authenticated SSE notification
                -> query invalidation -> REST projection refresh
```

The agent bearer token cannot read dashboard history. The CLI creates a
two-minute single-use bootstrap record containing only a hash. The browser sends
the code from its URL fragment to the same-origin session endpoint, receives an
eight-hour `HttpOnly`, `SameSite=Strict` cookie, and clears the fragment.

Dashboard totals are projections over persisted versioned events. Live SSE
notifies the browser that evidence changed; bounded REST queries load the
updated projection. Mutations require both the administrative cookie and exact
same-origin validation.

## Shutdown and cancellation

Client disconnect aborts upstream work. Process shutdown aborts active requests,
waits for observation chains, closes the provider and SQLite worker, and clears
memory-only compaction recovery. It never restarts or retries an inference.

## v0.5 retrieval flow

```text
eligible original context -> immutable local artifact
request identifiers/terms -> exact and FTS5 selection
selected original chunks -> injected prepared request
model marker replayed by client -> exact-ID then FTS5 selection
retrieval miss -> original request, one provider attempt, explicit miss event
```

The marker is `token_shuffle_retrieve("query")`. A model can emit it and a
normal coding-agent client can replay that assistant turn in the next request.
Selected content is bounded and injected as untrusted prior context. Search or
persistence failure fails open; retry count remains zero. See
[ADR 0014](decisions/0014-retrieval-request-and-retry-semantics.md).

## See also

- [Architecture overview](overview.md)
- [Package and module map](package-map.md)
- [Compatibility guarantees](decisions/0009-transparent-fidelity-and-compatibility.md)
- [Testing strategy](../testing/strategy.md)
