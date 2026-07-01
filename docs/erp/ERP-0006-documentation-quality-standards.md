# ERP-0006: Create Documentation Quality Standards

Status: Completed
Priority: P1
Category: Documentation, Contributor Experience
Origin Review: Engineering Review v0.4

## Observation

Token Shuffle's documentation has a strong voice and structure. That quality should become an explicit contributor standard.

## Evidence

The current docs consistently explain tradeoffs and avoid overclaiming. Future contributors and agents need guidance to preserve that standard.

## Recommendation

Create:

- `docs/contributing/documentation-standards.md`

Define expectations for:

- tone
- headings
- examples
- diagrams
- code snippets
- ADR references
- release references
- capability truthfulness
- cross-linking
- evidence-based claims

Encourage contributors to:

- explain why
- explain tradeoffs
- avoid marketing language
- prefer evidence over claims
- label speculation clearly

## Acceptance Criteria

- Documentation standards exist.
- Contributor docs link to the standards.
- Standards reinforce the existing project voice.
- Standards include practical examples.
- Standards are useful for both human contributors and coding agents.

## Files Likely Affected

- `docs/contributing/documentation-standards.md`
- `docs/contributing/workflow.md`
- `CONTRIBUTING.md`
- `AGENTS.md`

## Related ADRs

- ADR-0002: Observe Before Transform
- ADR-0009: Transparent Fidelity and Compatibility

## Implementation Notes

Keep the standards short enough that contributors will actually read them.

## Self-Review Checklist

- [ ] Are the standards practical?
- [ ] Do they preserve the project's tone?
- [ ] Are truthfulness rules explicit?
- [ ] Are examples included?
- [ ] Are contributor docs linked?

## Resolution

Completed for v0.5.

Created practical documentation standards covering voice, status language,
source-of-truth ownership, runnable examples, navigation, ADR/release/ERP
references, and a review checklist. Human and coding-agent contributor entry
points now link to them.

Files changed:

- `docs/contributing/documentation-standards.md`
- `docs/contributing/workflow.md`
- `CONTRIBUTING.md`
- `AGENTS.md`
- `docs/README.md`
- `docs/erp/ERP-0006-documentation-quality-standards.md`
- `docs/erp/README.md`

Validation:

- standards include practical good/bad claim examples;
- truthfulness labels match the capability matrix;
- contributor and agent guidance share one standards document.

Commit: `docs(contributing): codify documentation quality standards`
Release: v0.5.0
