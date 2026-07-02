# ADR 0014: Retrieval requests use the next client turn

- Status: Accepted
- Date: 2026-07-02

## Context

v0.5 requires a path for a model to request omitted context. Intercepting a
model tool call and launching another inference would add a hidden provider
attempt, duplicate cost, delay response commitment, and conflict with ADR 0010.
Coding-agent clients already replay assistant turns in the next conversation
request.

## Decision

Opt-in retrieval recognizes the explicit marker:

```text
token_shuffle_retrieve("query")
```

A model may emit the marker in its response. When the client includes that
assistant turn in its next ordinary Chat Completions request, Token Shuffle
searches artifacts from the same session and injects bounded matching content as
a developer message before the one configured provider attempt.

Retrieval also accepts a marker supplied directly by the user or agent. It does
not infer a query from arbitrary prompt prose.

Rules:

- retrieval is disabled by default;
- artifacts and search require an explicit session and are scoped to it;
- exact artifact identifiers are checked before FTS5 lexical matching;
- injected content is bounded by result count and characters;
- a miss fails open to the request without injected content;
- no inference retry or response interception occurs;
- events record hit/miss, artifact identifiers, injected counts, count
  provenance, and `retryCount: 0`, never the query or artifact content;
- persistence/search failure does not block or duplicate inference;
- deletion and retention apply to artifacts as well as events.

## Consequences

- Recovery is explicit and inspectable but requires the client’s next turn.
- The model cannot synchronously retrieve during the same inference in v0.5.
- ADR 0010 remains unchanged: there is one provider attempt per request.
- A future same-turn retrieval continuation requires a new ADR with attempt,
  commitment, cancellation, and cost accounting.
