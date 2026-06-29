# ADR 0005: Token optimization portfolio

- Status: Accepted
- Date: 2026-06-29

## Context

Token Shuffle needs a durable way to reason about several overlapping ideas:
response caching, externalized state, compaction, retrieval, tool-output
compression, delta prompting, provider prompt caching, and dynamic routing.
Treating all of them as equivalent or additive would produce misleading metrics
and weak implementation priorities.

## Decision

Adopt the taxonomy, safety rules, and recommended sequence in
[Token economics](../../product/token-economics.md).

In particular:

1. Context externalization is infrastructure, not an independent savings claim.
2. Savings are calculated once from the baseline and final forwarded request.
3. Deterministic tool-output compression and exact duplicate removal are the
   leading active-transform candidates after observation.
4. Structured compaction and retrieval follow once local artifact state exists.
5. Delta prompting requires an explicit, valid baseline.
6. Exact response caching is conservative and eligibility-driven.
7. Provider prompt caching and dynamic routing are reported separately from
   literal token reduction.
8. Full-session quality and net-token results decide whether a policy may become
   a default.

## Consequences

- Policy events may explain marginal decisions, but their individual savings
  cannot be summed when they affect the same content.
- The storage model must preserve original artifacts and summary provenance.
- Retrieval needs a recovery path when selection is incomplete.
- Cache keys and cache eligibility require security and side-effect analysis.
- The roadmap favors measurable, reversible transforms before lossy or
  provider-dependent techniques.
- Cost optimization can evolve without contaminating token-reduction claims.
