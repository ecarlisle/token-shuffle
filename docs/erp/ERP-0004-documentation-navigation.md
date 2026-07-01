# ERP-0004: Improve Documentation Navigation

Status: Completed
Priority: P1
Category: Documentation, Contributor Experience
Origin Review: Engineering Review v0.4

## Observation

The documentation is strong, but pages should guide readers more deliberately to the next useful document.

## Evidence

The documentation tree contains several useful sections. As the docs grow, readers need stronger wayfinding to avoid dead ends.

## Recommendation

Audit documentation pages and add lightweight navigation aids where helpful.

Each major document should answer:

- Why am I here?
- What should I read next?
- What related documents explain this further?

Add "See Also" sections where appropriate.

## Acceptance Criteria

- Major docs contain useful onward links.
- `docs/README.md` acts as a clear documentation hub.
- Dead ends are reduced.
- Links reflect the intended reader journey.
- Navigation supports users, developers, contributors, maintainers, and evaluators.

## Files Likely Affected

- `docs/README.md`
- `docs/getting-started/README.md`
- `docs/architecture/overview.md`
- `docs/architecture/package-map.md`
- `docs/architecture/decisions/README.md`
- `docs/product/token-economics.md`
- `docs/testing/strategy.md`
- `docs/contributing/workflow.md`

## Related ADRs

- ADR-0006: Evolutionary Package Boundaries
- ADR-0009: Transparent Fidelity and Compatibility

## Implementation Notes

Do not add heavy navigation chrome. Prefer small, useful "See Also" sections.

## Self-Review Checklist

- [ ] Can readers find what to read next?
- [ ] Are links accurate?
- [ ] Is navigation helpful without being noisy?
- [ ] Are audience-specific paths clearer?

## Resolution

Completed for v0.5.

Added lightweight onward navigation to the user journey, architecture overview,
package map, ADR index, token economics, testing strategy, and contributor
workflow. The documentation hub now includes Engineering Reviews and ERPs.

Files changed:

- `docs/README.md`
- `docs/getting-started/README.md`
- `docs/architecture/overview.md`
- `docs/architecture/package-map.md`
- `docs/architecture/decisions/README.md`
- `docs/product/token-economics.md`
- `docs/testing/strategy.md`
- `docs/contributing/workflow.md`
- `docs/engineering-reviews/*.md`
- `docs/erp/ERP-0004-documentation-navigation.md`
- `docs/erp/README.md`

Validation:

- major documents identify useful next reading;
- navigation remains lightweight;
- relative links are verified during release validation.

Commit: `docs(navigation): connect engineering documentation paths`
Release: v0.5.0
