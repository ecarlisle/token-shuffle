# Vision

## Problem

Coding agents repeatedly send large histories, tool schemas, tool results, and
project context to inference providers. Some repetition is necessary: a
stateless model cannot use context it does not receive. Some is redundant,
stale, or more detailed than the next inference needs.

Token Shuffle should help a user distinguish those cases. It sits on the local
machine, observes an agent's inference traffic, and can eventually apply
explicit policies that reduce context while preserving the evidence needed to
evaluate quality.

## Target user

The initial user is a technically capable individual running a coding agent
locally and willing to point an OpenAI-compatible base URL at a loopback proxy.
Team deployment, centralized policy, and hosted operation are not initial
goals.

## Success

Token Shuffle is successful when it can demonstrate, on real agent sessions:

- provider-verified or tokenizer-derived token counts;
- a lower forwarded input count after an enabled transform;
- the cost of performing that transform;
- no meaningful regression on replayed task outcomes;
- enough before/after evidence for a user to disable a bad policy.

The north-star metric is **quality-adjusted net input reduction**, not the
largest possible compression ratio.

## Non-goals for early versions

- A general API gateway or enterprise control plane.
- A claim that cheaper models or prompt caching literally remove tokens.
- Silent semantic rewriting.
- Sending recorded prompts to a hosted Token Shuffle service.
- Supporting every provider protocol before one path is trustworthy.

## Operating principles

1. Pass through on uncertainty or internal failure.
2. Observe-only is the default until the user enables a policy.
3. Raw payload retention is off by default.
4. Every transformation emits a reason and a replayable diff.
5. Measurements carry their provenance and uncertainty.
6. Quality gates can veto savings.
7. Externalization is infrastructure; only final request reduction is counted.
8. Response reuse, provider caching, routing, and literal reduction remain
   separate optimization categories.
