# Hypothesis: Authority and Confidence

The Engineering Knowledge Graph should distinguish between authority and confidence.

Authority answers:

> What weight should this knowledge carry?

Confidence answers:

> How certain are we that this claim or relationship is correct?

These are related but not identical.

## Examples

| Artifact or Relationship | Authority | Confidence |
| --- | --- | --- |
| ADR | High | Medium to High |
| Engineering Review | High Evidence | High |
| Release Validation | High Evidence | High |
| Git Diff | Observation | High |
| AI-inferred Relationship | Low | Numeric or provisional |
| Human-approved Relationship | High | High |

## Why This Matters

A stale ADR may remain authoritative but have lower current confidence.

A fresh AI inference may have high confidence but low authority until approved.

Context selection should consider both.
