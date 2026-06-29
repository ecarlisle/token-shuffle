# Architecture

## Initial shape

```text
agent client
    |
    | OpenAI-compatible HTTP + SSE
    v
loopback proxy
    |-- ingress validation
    |-- execution coordinator
    |     |-- baseline measurement
    |     |-- route candidates
    |     |-- candidate-specific context
    |     |-- cache eligibility
    |     `-- provider attempts
    |-- immutable decision events
    v
inference provider

event stream --> local SQLite --> local dashboard / replay
```

The proxy is a single local Node.js process. It serves the API and, once built,
the dashboard assets. Keeping one process simplifies installation and prevents
an unnecessary local distributed system.

## Package boundaries

- `apps/proxy`: HTTP/SSE lifecycle, configuration, fail-open behavior, and
  composition root. Its internal execution coordinator owns application
  sequencing; Fastify handlers remain transport adapters.
- `packages/core`: provider-neutral request model, policy decisions, accounting,
  event concepts, and ports. It must not import Fastify, storage
  implementations, or provider SDKs.
- `apps/web`: read-only visualization first; policy editing comes later.
- future packages are extracted only when the triggers in the
  [package and module map](package-map.md) are met.

## Request lifecycle

1. Assign a local request and session identifier.
2. Parse only the protocol fields required for measurement.
3. Calculate the baseline using the best available tokenizer and record its
   provenance.
4. Produce an ordered candidate route plan from explicit capabilities and
   recorded policy inputs.
5. Prepare context for the selected candidate. In observe mode it remains
   semantically unchanged; transform uncertainty returns the original context.
6. Evaluate exact-response cache eligibility using the prepared request, target,
   scope, and policy versions.
7. Execute the provider attempt and stream without buffering the full response.
8. On eligible failure before response commitment, select the next candidate and
   prepare context again for its tokenizer, limits, and capabilities.
9. Capture usage events and persist a redacted decision event asynchronously.

The hot path must not wait for dashboard writes. Backpressure and client
disconnect propagation are first-class integration-test concerns.

The execution coordinator owns this lifecycle. The route planner does not call
providers or perform retries, and context policies do not select routes.

## Externalized context model

Original context may be stored locally as immutable, addressable artifacts.
Policies can select exact ranges, retrieve relevant artifacts, or produce
versioned summaries before constructing the forwarded request. References are
never assumed to be meaningful to a stateless model: selected content must be
injected, exposed through a retrieval tool, or backed by explicit provider
state.

The decision event records source artifact identifiers, policy order, omitted
ranges, summary versions, count provenance, and the final request-level token
impact. This supports replay without attributing the same saved tokens to
externalization, retrieval, and compaction simultaneously.

Response caching is a separate pre-inference decision. Cache entries are scoped
by authorization and environment, and requests involving changing external
state, side effects, or nondeterministic behavior are ineligible by default.

## Storage and privacy

SQLite is appropriate for one local writer and dashboard readers. WAL mode may
be used only with SQLite 3.51.3 or a fixed backport because older WAL versions
contain a known rare multi-connection corruption bug. The database is not
supported on a network filesystem.

Default events contain counts, timings, structural metadata, keyed content
hashes, and redacted decision explanations. Raw prompts and responses are not
retained unless a user explicitly enables a bounded replay capture. Provider
credentials remain in process memory and must never enter events or logs.

## Failure policy

- Upstream errors pass through without being disguised.
- Measurement failure does not block inference.
- Transform failure sends the original body if no upstream bytes were sent.
- The proxy binds to `127.0.0.1` by default.
- Non-loopback binding requires explicit configuration and later authentication
  work; it is out of scope for the first usable release.

## Performance position

The proxy is predominantly network and stream I/O, so TypeScript on Node.js is a
reasonable initial choice. Performance-sensitive tokenization may use native or
WASM libraries behind an interface. Rewriting the proxy in another language
requires profiling evidence and an ADR.
