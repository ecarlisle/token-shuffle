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
    |     |-- ordered context policies
    |     |-- one configured upstream
    |     `-- one provider attempt
    |-- immutable decision events
    v
inference provider

event stream --> local SQLite --> local dashboard / replay
```

The proxy is a single local Node.js process. It serves the API and, once built,
the dashboard assets. Keeping one process simplifies installation and prevents
an unnecessary local distributed system.

The production workstation distribution adds a thin Tauri shell that supervises
this process and displays the dashboard. The proxy remains independently
runnable and does not depend on the desktop window lifecycle. See the
[technology stack](technology-stack.md).

## Package boundaries

- `apps/proxy`: HTTP/SSE lifecycle, configuration, fail-open behavior, and
  composition root. Its internal execution coordinator owns application
  sequencing; Fastify handlers remain transport adapters.
- `packages/core`: provider-neutral request model, policy decisions, accounting,
  event concepts, and ports. It must not import Fastify, storage
  implementations, or provider SDKs.
- `apps/web`: evidence visualization plus authenticated history/recovery
  deletion. Policy configuration remains file-based.
- future packages are extracted only when the triggers in the
  [package and module map](package-map.md) are met.

## Request lifecycle

For narrative startup, observe, optimize, dashboard, and shutdown sequences, see
[Request-flow walkthroughs](request-flows.md).

1. Assign a local request ID, an attempt ID, and an explicit or inferred session
   association.
2. Retain the raw request body and parse a separate measurement view.
3. Calculate the baseline using the best available tokenizer and record its
   provenance.
4. Apply ordered context policies. In observe mode the prepared request remains
   semantically unchanged; transform uncertainty returns the original context.
5. Execute one attempt against the one configured upstream and stream without
   buffering the full response.
6. Propagate success, upstream failure, or cancellation without an automatic
   retry or failover.
7. Capture versioned usage and lifecycle events and persist them asynchronously.

The hot path must not wait for dashboard writes. Backpressure and client
disconnect propagation are first-class integration-test concerns.

The execution coordinator owns this lifecycle. A route planner is not yet
implemented because v0.4 has one configured upstream. Future retry or failover
behavior requires a new decision rather than emerging from provider-library
defaults.

Observe mode forwards raw valid JSON body bytes unchanged. Authentication,
hop-by-hop, host, length, cookie, origin, and internal headers follow an explicit
replacement/removal policy. Buffered bodies and SSE event payloads are
preserved; TCP chunk boundaries are not. See the
[fidelity ADR](decisions/0009-transparent-fidelity-and-compatibility.md).

## Planned externalized context model

Beginning in planned v0.5 work, original context may be stored locally as
immutable, addressable artifacts.
Policies can select exact ranges, retrieve relevant artifacts, or produce
versioned summaries before constructing the forwarded request. References are
never assumed to be meaningful to a stateless model: selected content must be
injected, exposed through a retrieval tool, or backed by explicit provider
state.

The decision event records source artifact identifiers, policy order, omitted
ranges, summary versions, count provenance, and the final request-level token
impact. This supports replay without attributing the same saved tokens to
externalization, retrieval, and compaction simultaneously.

Future response caching is a separate pre-inference decision. Cache entries are scoped
by authorization and environment, and requests involving changing external
state, side effects, or nondeterministic behavior are ineligible by default.

## Storage and privacy

SQLite is appropriate for one local writer and dashboard readers. WAL mode may
be used only with SQLite 3.51.3 or a fixed backport because older WAL versions
contain a known rare multi-connection corruption bug. The database is not
supported on a network filesystem.

Default events contain counts, timings, structural metadata, and redacted
decision explanations. Raw prompts and responses are not
retained unless a user explicitly enables a bounded replay capture. Provider
credentials remain in process memory and must never enter events or logs.

## Failure policy

- Upstream errors pass through without being disguised.
- Measurement failure does not block inference.
- Transform failure sends the original body if no upstream bytes were sent.
- The proxy binds to `127.0.0.1` by default.
- Non-loopback binding is unsupported.

## Performance position

The proxy is predominantly network and stream I/O, so TypeScript on Node.js is a
reasonable initial choice. Performance-sensitive tokenization may use native or
WASM libraries behind an interface. Rewriting the proxy in another language
requires profiling evidence and an ADR.

## See also

- [Request-flow walkthroughs](request-flows.md)
- [Package and module map](package-map.md)
- [Technology stack](technology-stack.md)
- [Architecture decisions](decisions/README.md)
- [Capability status](../capabilities.md)
