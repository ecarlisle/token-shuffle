# ADR 0012: Resource and timeout limits

- Status: Accepted
- Date: 2026-06-29

## Context

A workstation proxy needs bounded memory, concurrency, headers, bodies, SSE
events, and persistence queues. Unlimited buffering can make a local malformed
or hostile request affect the entire workstation. Conversely, a short total
timeout can break legitimate long-running reasoning or tool use.

Initial values should be visible, configurable where safe, and revised from
measurements rather than folklore.

## Decision

Adopt these provisional v0.1 defaults:

| Limit | Default |
| --- | ---: |
| Request body | 16 MiB |
| Request headers | 16 KiB |
| Concurrent inference requests | 16 |
| Upstream connection timeout | 10 seconds |
| Response-header timeout | 5 minutes |
| Stream idle timeout | 2 minutes |
| Total inference timeout | Disabled |
| Single SSE event | 8 MiB |

Persistence queues are bounded by both event count and encoded bytes. Their
initial numeric bounds are selected during the storage implementation benchmark,
published in configuration documentation, and cannot be unlimited.

Behavior:

- reject oversized input before upstream dispatch with an explicit `413`;
- reject excess concurrency with `429` rather than an unbounded memory queue;
- classify connection, header, and idle timeouts distinctly;
- abort the upstream operation on timeout or client cancellation;
- never turn a local timeout into an automatic retry;
- expose effective non-secret limits through diagnostics;
- allow safe limit overrides through validated configuration;
- record persistence overflow as degraded operation and a dropped-event count
  without buffering raw requests indefinitely.

Changes based on benchmark evidence update documentation and tests. Materially
different defaults require an ADR amendment or superseding decision.

## Consequences

- Very large multimodal requests may require an explicit configuration change.
- Long inferences remain possible as long as the stream is active.
- Local overload fails visibly instead of degrading the workstation.
- Limit boundaries, slow streams, persistence overflow, and timeout classes need
  deterministic tests.
