# ADR 0002: Observe before transforming

- Status: Accepted
- Date: 2026-06-29

## Context

The best compression target depends on the client, provider, model, tools, and
session. Transforming prompts before measuring the baseline makes savings claims
weak and risks degrading tasks without evidence.

## Decision

The first usable milestone is semantically transparent observation. Active
transforms are opt-in, ordered policies introduced only with replay fixtures
and a counterfactual metric. The exact body, header, streaming, and error
fidelity guarantees are defined separately rather than assumed by the word
“transparent.”

## Consequences

- The project produces useful evidence before promising optimization.
- Initial demos may look less dramatic.
- Event contracts and tokenizer provenance become foundational.
- A transform can be evaluated in shadow mode before changing live traffic.
- Observe mode must never inject fields merely to improve measurement.
