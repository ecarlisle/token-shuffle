# Engineering Knowledge Graph

## Hypothesis

Token Shuffle may evolve beyond token savings into a system that helps preserve engineering continuity across human and AI contributors.

The core idea is that project knowledge is not only contained in documents, but in the relationships between them.

## Concept

Engineering artifacts can be modeled as nodes:

- Vision documents
- ADRs
- Engineering Reviews
- Engineering Review Packets
- Release validations
- Commits
- Pull requests
- Issues
- Tags
- Releases
- Tests
- Documentation pages

The value comes from the edges:

- implements
- supersedes
- validates
- references
- motivated by
- resolved by
- introduced by
- affected by
- challenged by
- released in

## Direction

The graph should preserve history rather than overwrite it.

When engineering judgment changes, new evidence should extend the graph instead of rewriting prior decisions.

The goal is not to automate engineering judgment, but to preserve it.
