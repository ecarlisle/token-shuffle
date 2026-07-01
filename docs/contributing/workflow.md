# Change workflow

## Before implementation

1. State the user outcome and how it will be measured.
2. Identify affected ADRs, protocols, privacy assumptions, and roadmap scope.
3. For a transform, add or select replay fixtures before enabling it.

## During implementation

Keep code, tests, and documentation in the same branch and normally the same
commit. Prefer small vertical slices. Avoid adding a provider abstraction until
two concrete implementations expose the boundary.

Do not create a workspace package solely because a module has a distinct name.
Package extraction must satisfy the trigger in the
[package and module map](../architecture/package-map.md), preserve dependency
direction, and include an ADR when it changes architectural ownership.

Treat commands and configuration in user documentation as public contracts.
When behavior changes, update the relevant getting-started guide and its parsed
example fixture in the same change.

## Verification

Run:

```sh
pnpm check
```

Protocol and UI work must also run the relevant integration or end-to-end suite
once those scripts exist. Record manual verification only when automation is
not practical, and create a follow-up issue for important gaps.

## Commit

Use an imperative subject with a focused scope:

```text
type(scope): outcome
```

Allowed examples include `feat`, `fix`, `docs`, `test`, `refactor`, `perf`,
`build`, and `chore`. The body should explain why when the diff cannot.

Do not make a ritual documentation edit with no information value. If code does
not affect documented behavior, add a test and explicitly say “docs unchanged”
in the commit body or review notes.

## Review checklist

- Are claimed savings literal tokens, cache discounts, cost, or latency?
- Does every count state its provenance?
- Can the proxy fail open without duplicating an inference request?
- Are streaming and disconnect behavior preserved?
- Could logs, events, fixtures, or replay expose a secret?
- Does the roadmap place this capability in the intended release?

## See also

- [Contributor guide](../../CONTRIBUTING.md)
- [Documentation standards](documentation-standards.md)
- [Testing strategy](../testing/strategy.md)
- [Engineering Review Packets](../erp/README.md)
