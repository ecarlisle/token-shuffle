# ERP-0001: Improve the Repository Front Door

Status: Completed
Priority: P0
Category: Documentation, Developer Experience
Origin Review: Engineering Review v0.4

## Observation

The repository README should make the project understandable within the first five minutes.

A first-time visitor should not need to read the entire documentation set before understanding what Token Shuffle does, whether it is useful, and where to go next.

## Evidence

The project has strong supporting documentation, but the front-door experience should more clearly distinguish:

- what the project is
- why it exists
- what works today
- what is planned
- how to start locally
- where contributors should begin

## Recommendation

Improve the top-level README so it clearly answers:

- What is Token Shuffle?
- Why does it exist?
- Who is it for?
- What works in v0.4?
- What is planned?
- How do I try it?
- Where should contributors start?

Make the README a navigation hub rather than an encyclopedia.

## Acceptance Criteria

- README is a clear navigation hub.
- New users can understand the project quickly.
- README links naturally to getting started, architecture, roadmap, ADRs, and contribution docs.
- Detailed explanations move deeper into docs instead of crowding the front door.
- README avoids overclaiming future capabilities.

## Files Likely Affected

- `README.md`
- `docs/README.md`
- `docs/getting-started/README.md`

## Related ADRs

- ADR-0002: Observe Before Transform
- ADR-0003: OpenAI-Compatible First
- ADR-0005: Token Optimization Portfolio

## Implementation Notes

Preserve the measured tone of the current documentation. Do not convert the README into marketing copy.

## Self-Review Checklist

- [ ] Is the README clearer?
- [ ] Is duplication reduced?
- [ ] Can a new user find the next step?
- [ ] Does the README avoid overclaiming?
- [ ] Does it preserve the project's design principles?

## Resolution

Completed for v0.5.

The README is now a concise navigation hub that explains the problem, intended
audience, stable v0.4 capability boundary, provisional compatibility, planned
v0.5 scope, repository-checkout workflow, architecture/ADR entry points, and
contributor path. Detailed configuration remains in getting-started docs.

Files changed:

- `README.md`
- `docs/erp/ERP-0001-readme-front-door.md`
- `docs/erp/README.md`

Validation:

- current and planned behavior are separated;
- live validation scope is named conservatively;
- all required user and contributor entry points are linked.

Commit: `docs(readme): improve the repository front door`
Release: v0.5.0
