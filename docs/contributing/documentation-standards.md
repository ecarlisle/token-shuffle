# Documentation quality standards

Token Shuffle documentation is a product contract. Write for a reader who must
decide what is safe, supported, and worth trusting.

## Voice and claims

- Prefer measured technical language over marketing.
- Explain why a behavior exists and name meaningful tradeoffs.
- Distinguish **Validated**, **Implemented**, **Experimental**, **Planned**,
  **Deferred**, and **Speculative** using the definitions in the
  [capability matrix](../capabilities.md).
- Do not infer broad compatibility from one protocol or provider test.
- Put evidence near consequential claims.

Prefer:

> Deterministic compaction is experimental and covered by replay fixtures.

Avoid:

> Token Shuffle automatically makes every agent session smaller.

## Document ownership

| Information | Source of truth |
| --- | --- |
| Present capabilities | `docs/capabilities.md` |
| Tested combinations | `docs/compatibility.md` |
| Future evidence gates | `docs/roadmap.md` |
| Historical outcomes | `docs/version-history.md` |
| Durable decisions | `docs/architecture/decisions/` |
| User behavior | `docs/getting-started/` |
| Release evidence | `docs/testing/` |
| Review findings and work | `docs/engineering-reviews/`, `docs/erp/` |

Avoid copying the same detailed explanation into multiple sources. Link to the
owner and summarize only what the current reader needs.

## Commands and examples

- Treat commands and configuration as tested public contracts.
- Distinguish packaged/linked CLI syntax from repository `pnpm proxy:*` scripts.
- Use synthetic placeholders and never include real credentials or prompts.
- State prerequisites before a command.
- Parse JSON/JSONC examples during validation.
- Include expected outcomes when failure would otherwise be ambiguous.

## Structure and navigation

- Use descriptive headings and short introductory context.
- Prefer prose or a compact list; use a diagram only when sequence, ownership,
  or branching is materially clearer.
- Add a focused **See also** section when a major page would otherwise be a dead
  end.
- Update `docs/README.md` whenever a document is added or moved.
- Use relative Markdown links inside the repository.

## ADR, release, and ERP references

- Link an ADR when behavior depends on an accepted architectural constraint.
- Link release validation when calling a capability validated or experimental.
- Do not rewrite ADR history silently; supersede it.
- When completing an ERP, record status, rationale, files, validation, release,
  and a stable commit subject/reference.

## Review checklist

- Is every present-tense capability claim true in code?
- Does its status match the capability matrix?
- Are compatibility and validation scopes precise?
- Are future features visibly future?
- Are commands runnable from the context described?
- Are security, privacy, failure, and retention behavior explicit?
- Do all relative links and structured examples validate?

## See also

- [Change workflow](workflow.md)
- [Contributor guide](../../CONTRIBUTING.md)
- [Engineering Reviews](../engineering-reviews/README.md)
- [Engineering Review Packets](../erp/README.md)
