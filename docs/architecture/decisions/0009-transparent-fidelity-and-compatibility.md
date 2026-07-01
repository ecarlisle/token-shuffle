# ADR 0009: Transparent fidelity and compatibility guarantees

- Status: Accepted
- Date: 2026-06-29

## Context

“Observe-only” and “OpenAI-compatible” are ambiguous without testable
guarantees. A proxy can preserve the meaning of a request while changing bytes,
silently drop unknown fields, alter SSE boundaries, replace provider errors, or
claim broad compatibility after one successful request.

The initial release uses the same OpenAI Chat Completions protocol on ingress and
egress, so it can offer a stronger transparent pass-through contract than future
cross-protocol adapters.

## Decision

### Request envelope

Retain:

- the raw valid JSON body bytes used for forwarding;
- a parsed measurement view;
- local request metadata and decisions.

For a supported v0.1 request in observe mode, forward the original body bytes
without reserialization, field injection, defaulting, model rewriting, key
reordering, or unknown-field removal. Shadow policies cannot alter the forwarded
body.

Minimal validation requires a JSON object, supported route, required core field
types, and accepted resource limits. Invalid or unsupported input receives a
distinct Token Shuffle error and is not partially forwarded.

### Request headers

Headers are not byte-preserved. Consume and never forward local authorization,
cookies, origin metadata, `Host`, `Content-Length`, hop-by-hop headers, and
Token Shuffle internal headers. Provider adapters create upstream authorization
and transport headers.

Preserve only documented safe headers. Provider organization, project, beta, or
feature headers belong to explicit upstream configuration unless a compatibility
test adds them to the supported ingress contract.

### Responses

For buffered responses, preserve upstream status, body bytes, content type,
supported provider request identifiers, and provider error body. Remove or
recalculate transport-specific and unsafe headers.

For SSE responses, preserve ordered events, event names, `data` payload bytes,
blank-line event boundaries, and terminal events. Propagate backpressure and
client cancellation without buffering the full stream.

TCP chunk boundaries, packet timing, and upstream flush timing are not
compatibility guarantees.

Observe mode does not inject `stream_options` or another measurement aid. Usage
is recorded when supplied by the client/provider contract; otherwise a
compatible tokenizer or estimate is used with explicit provenance.

### Errors

Provider errors preserve provider status and body and are marked internally as
upstream-originated. Token Shuffle errors use a stable
`token_shuffle_error` envelope and an identifying response header. They never
contain secrets, raw retained content, or internal stack traces.

### Transform modes

Active transforms intentionally lose byte fidelity. Their decision records
include original and final fingerprints, policy versions, changed fields or
ranges, counts before and after, optimization cost, and fallback outcome.
Observe and shadow modes remain non-mutating.

### Compatibility claims

Publish a matrix by tested client version, ingress protocol, upstream provider,
model, and feature. Use:

- **Verified:** automated contract suite and real smoke test pass;
- **Provisional:** fixtures pass but real-provider coverage is incomplete;
- **Unsupported:** known not to work;
- **Unknown:** not tested.

The matrix covers buffered responses, SSE, tool calls, parallel tool calls,
developer roles, images, reasoning fields, streaming usage, unknown fields,
provider errors, cancellation, and applicable limits.

OpenAI direct is the first reference smoke target. OpenRouter is the second
provisional target. A concrete tool-capable model is pinned in release test
metadata when implementation begins. “OpenAI-compatible” names a protocol
family and is not itself a support claim.

Future translated-protocol adapters guarantee documented semantic mappings, not
the transparent byte-level contract.

Explicit same-protocol provider capability mappings are governed by
[ADR 0013](0013-provider-capability-normalization.md). When configured, they
normalize only at provider dispatch and are documented exceptions to
byte-preserving egress; inbound observation still uses the original request.

## Consequences

- Observe-mode forwarding must retain raw body bytes alongside a parsed view.
- Fastify ingress must not force body reserialization on the transparent path.
- Header behavior is an explicit security and compatibility contract.
- Missing usage may remain estimated rather than changing a live request.
- Compatibility documentation and fixtures are release artifacts.
- Cross-protocol support receives a separate, weaker but explicit fidelity
  contract.
