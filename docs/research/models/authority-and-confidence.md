# Model: Authority and Confidence

Authority and confidence are separate dimensions of engineering knowledge.

Authority asks:

> What weight should this artifact or relationship carry?

Confidence asks:

> How certain are we that this artifact or relationship is correct and current?

## Examples

| Case | Authority | Confidence |
| --- | --- | --- |
| Accepted ADR | High | Medium to High |
| Engineering Review | High Evidence | High |
| Fresh Git Diff | Observation | High |
| AI-inferred relationship | Low | Variable |
| Human-approved relationship | High | High |

## Implication

Token Shuffle should avoid treating all retrieved context as equal.
