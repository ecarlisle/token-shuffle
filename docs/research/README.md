# Research Laboratory

Research documents capture exploratory ideas before they become architecture.

ADRs record decisions. Research records questions, hypotheses, models, experiments, and findings.

The Research Laboratory exists so Token Shuffle can explore promising directions without prematurely treating them as product commitments.

## Core Rule

Research documents are hypotheses, not commitments.

Their purpose is to explore promising directions, define experiments, and record findings. A research document becomes architecture only after it has been validated through implementation, observation, and engineering review.

## Taxonomy

```text
docs/research/
├── README.md
├── hypotheses/
├── topology/
├── graph/
├── observatory/
├── governance/
├── models/
├── experiments/
├── findings/
├── glossary/
└── future/
```

## Research Lifecycle

```text
Observation
  -> Hypothesis
  -> Topology / Model
  -> Experiment
  -> Finding
  -> ADR, if accepted
  -> Engineering Practice
```

## Relationship to ADRs

Research documents may be speculative. ADRs should not be speculative.

If research produces a validated architectural direction, the result may be promoted into an ADR. The original research should remain as historical context.

## Relationship to Engineering Reviews

Engineering Reviews provide evidence.

Research may use Engineering Review findings to form hypotheses, propose experiments, or identify recurring project precedent.

## Relationship to ERPs

Engineering Review Packets are actionable work items.

Research may produce ERPs when an experiment identifies bounded implementation work.
