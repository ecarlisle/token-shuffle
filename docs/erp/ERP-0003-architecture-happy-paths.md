# ERP-0003: Add Architecture Happy-Path Walkthroughs

Status: Completed
Priority: P1
Category: Architecture, Documentation
Origin Review: Engineering Review v0.4

## Observation

The architecture documentation explains components well, but contributors would benefit from narrative request-flow walkthroughs.

## Evidence

The project has ADRs, package maps, and architectural overviews. Those are strong, but a new contributor may still need to read TypeScript to understand how a request travels through the system.

## Recommendation

Create:

- `docs/architecture/request-flows.md`

Include walkthroughs for:

- observe mode request flow
- startup sequence
- dashboard update sequence
- authentication flow
- future optimization pipeline

Each walkthrough should explain:

- which component acts
- what data changes
- why the step exists
- what should remain protocol-compatible

## Acceptance Criteria

- A contributor can understand request movement without reading code.
- The document avoids implementation noise.
- The document links to relevant ADRs and package-map sections.
- Future optimization flows are clearly marked as future or planned.

## Files Likely Affected

- `docs/architecture/request-flows.md`
- `docs/architecture/overview.md`
- `docs/architecture/package-map.md`
- `docs/README.md`

## Related ADRs

- ADR-0002: Observe Before Transform
- ADR-0003: OpenAI-Compatible First
- ADR-0009: Transparent Fidelity and Compatibility
- ADR-0010: Execution and Retry Semantics
- ADR-0011: Event and Session Identity

## Implementation Notes

Use simple text diagrams. Avoid UML unless it genuinely helps.

## Self-Review Checklist

- [ ] Are request flows easy to follow?
- [ ] Are implemented and future flows separated?
- [ ] Are relevant ADRs linked?
- [ ] Could a contributor understand the system without opening source files?

## Resolution

Completed for v0.5.

Added narrative and text-diagram walkthroughs for startup, observe-mode
inference, optimize-mode inference, dashboard authentication/live updates, and
shutdown. The v0.5 retrieval flow is isolated and marked planned.

Implementation differs from the original recommendation by documenting the
already implemented v0.3/v0.4 optimization pipeline as current behavior rather
than labeling all optimization as future.

Files changed:

- `docs/architecture/request-flows.md`
- `docs/architecture/overview.md`
- `docs/README.md`
- `docs/erp/ERP-0003-architecture-happy-paths.md`
- `docs/erp/README.md`

Validation:

- current and planned flows are visually separated;
- relevant ADRs and release validation are linked;
- no source-code reading is required to follow the primary lifecycle.

Commit: `docs(architecture): add request flow walkthroughs`
Release: v0.5.0
