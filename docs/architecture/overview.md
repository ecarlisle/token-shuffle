# Architecture

## Initial shape

```text
agent client
    |
    | OpenAI-compatible HTTP + SSE
    v
loopback proxy
    |-- ingress validation
    |-- observe / policy pipeline
    |-- immutable decision events
    |-- provider adapter
    v
inference provider

event stream --> local SQLite --> local dashboard / replay
```

The proxy is a single local Node.js process. It serves the API and, once built,
the dashboard assets. Keeping one process simplifies installation and prevents
an unnecessary local distributed system.

## Package boundaries

- `apps/proxy`: HTTP/SSE lifecycle, configuration, fail-open behavior, and
  composition root.
- `packages/core`: provider-neutral request model, policy decisions, accounting,
  and event contracts. It must not import Fastify or provider SDKs.
- `apps/web`: read-only visualization first; policy editing comes later.
- future `packages/providers-*`: protocol translation and provider-specific
  usage/caching metadata.

## Request lifecycle

1. Assign a local request and session identifier.
2. Parse only the protocol fields required for measurement.
3. Calculate the baseline using the best available tokenizer and record its
   provenance.
4. In observe mode, forward unchanged. In transform mode, run ordered policies;
   any uncertainty or failure returns the original request.
5. Stream the upstream response without buffering the full body.
6. Capture usage trailers/events where the protocol provides them.
7. Persist a redacted decision event asynchronously.

The hot path must not wait for dashboard writes. Backpressure and client
disconnect propagation are first-class integration-test concerns.

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
