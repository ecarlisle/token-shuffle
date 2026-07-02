# Engineering Knowledge Graph Topography

> Status: Research  
> Purpose: Explore how engineering knowledge may be organized, related, and surfaced to humans and AI contributors.

## Overview

The Engineering Knowledge Graph is a proposed model for representing the engineering knowledge of a software project.

Unlike traditional documentation, which treats documents as isolated artifacts, the Engineering Knowledge Graph treats each artifact as part of a connected body of knowledge whose value emerges from relationships.

The goal is not to automate engineering judgment, but to preserve it.

## Knowledge Layers

### Intent Layer

Represents where the project intends to go.

Examples:

- Vision
- Product goals
- Roadmap
- Engineering Review Packets
- Issues
- Feature proposals
- Milestones

### Decision Layer

Represents accepted engineering decisions.

Examples:

- ADRs
- Accepted design proposals
- Engineering principles

### Evidence Layer

Represents observations captured at a specific point in time.

Examples:

- Engineering Reviews
- Release validation
- Test reports
- Benchmark reports
- Security reviews
- CI results

### Observation Layer

Represents continuously changing engineering information.

Examples:

- Git diffs
- Commits
- Pull requests
- Build output
- Coverage reports
- Bundle analysis
- Runtime metrics
- Token metrics

### Practice Layer

Represents how the engineering team chooses to work.

Examples:

- AGENTS.md
- Contribution workflow
- Coding standards
- Documentation standards
- Repository conventions

### Precedent Layer

Represents accumulated engineering reasoning that emerges from historical relationships.

Precedent is not authored directly. It emerges from connected evidence.

## Authority

| Artifact | Authority |
| --- | --- |
| Vision | Foundational |
| ADR | High |
| Engineering Principle | High |
| Engineering Review | High Evidence |
| Release Validation | High Evidence |
| ERP | Medium |
| Documentation | Medium |
| Pull Request | Supporting Evidence |
| Commit | Observation |
| Git Diff | Observation |

## Knowledge Velocity

| Artifact | Velocity |
| --- | --- |
| Vision | Very Slow |
| ADR | Slow |
| Engineering Principles | Slow |
| Documentation Standards | Slow |
| Roadmap | Medium |
| ERP | Medium |
| Documentation | Medium |
| Pull Request | Fast |
| Git Diff | Very Fast |
| Build Output | Very Fast |
| Runtime Metrics | Very Fast |

## Relationships

Possible graph relationships include:

- implements
- references
- validates
- motivates
- supersedes
- introduces
- resolves
- affected by
- reviewed by
- released in
- tested by
- challenged by

## Role of Token Shuffle

Documents preserve knowledge.

The Engineering Knowledge Graph preserves relationships.

Token Shuffle preserves relevance.

The application may observe current engineering activity and identify which historical knowledge is relevant to the work being performed.

## Research Questions

- Can engineering relationships be inferred reliably from repository activity?
- Which relationships require explicit human approval?
- How should confidence be represented?
- How can engineering precedent be surfaced without overwhelming contributors?
- How should context selection balance authority, relevance, and recency?
- Can preserving engineering continuity improve consistency across different AI models?
