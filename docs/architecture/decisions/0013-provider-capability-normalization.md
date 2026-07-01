# ADR 0013: Explicit provider capability normalization

- Status: Accepted
- Date: 2026-07-01

## Context

OpenAI-compatible providers do not implement an identical message-role set.
DeepSeek-compatible routes can reject OpenAI `developer` messages even when the
rest of the Chat Completions request is valid. Inferring provider behavior from
a URL or model name is unreliable because gateways can route models behind a
shared endpoint.

ADR 0009 requires byte-preserving observe-mode forwarding. Silently rewriting
all requests would violate that contract, while refusing an explicit,
provider-required mapping prevents otherwise compatible inference.

## Decision

Provider capability normalization is explicit configuration owned by the
provider adapter. The OpenAI-compatible adapter supports:

- `developerRole: preserve`, the default byte-preserving behavior;
- `developerRole: system`, which changes each outbound `developer` message role
  to `system`.

Ingress validation, measurement, and structural observation use the original
request. Normalization occurs only immediately before provider dispatch.
Message content and fields, supported message roles, top-level fields, and
unknown fields are retained. If no developer message exists, the adapter sends
the original bytes.

Compatibility normalization is independent of observe/optimize mode and is not
counted as token optimization. Documentation and compatibility evidence must
identify when byte fidelity is intentionally relaxed.

## Consequences

- DeepSeek behavior is configured rather than guessed from hostnames or models.
- The default fidelity contract remains unchanged.
- A configured request containing developer messages is semantically, not
  byte, preserved on egress.
- New provider-specific mappings require fixtures and a documented capability;
  they must not accumulate as implicit generic rewrites.

## Relationship to ADR 0009

This ADR narrows ADR 0009 for explicitly configured provider capability
normalization. ADR 0009 remains authoritative for requests that do not require
such a mapping.
