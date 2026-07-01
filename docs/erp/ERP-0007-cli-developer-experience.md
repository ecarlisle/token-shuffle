# ERP-0007: Clarify CLI Developer Experience

Status: Completed
Priority: P0
Category: Developer Experience, Documentation, CLI
Origin Review: Engineering Review v0.4

## Observation

The documentation references installed CLI commands such as:

```sh
token-shuffle start
token-shuffle status
```

However, local development currently uses commands such as:

```sh
node apps/proxy/dist/cli.js --config "$PWD/config.local.jsonc" start
```

This can confuse contributors who are working from a repository checkout.

## Evidence

Codex suggested repository-local commands:

```sh
node apps/proxy/dist/cli.js --config "$PWD/config.local.jsonc" start
node apps/proxy/dist/cli.js --config "$PWD/config.local.jsonc" status
node apps/proxy/dist/cli.js --config "$PWD/config.local.jsonc" open
node apps/proxy/dist/cli.js --config "$PWD/config.local.jsonc" doctor
node apps/proxy/dist/cli.js --config "$PWD/config.local.jsonc" stop
```

These commands are useful but too verbose for primary getting-started docs.

## Recommendation

Clarify the difference between:

- installed CLI usage
- local repository development usage

Add root `package.json` scripts for the local CLI workflow.

Suggested scripts:

```json
{
  "proxy:cli": "node apps/proxy/dist/cli.js --config ./config.local.jsonc",
  "proxy:start": "node apps/proxy/dist/cli.js --config ./config.local.jsonc start",
  "proxy:status": "node apps/proxy/dist/cli.js --config ./config.local.jsonc status",
  "proxy:open": "node apps/proxy/dist/cli.js --config ./config.local.jsonc open",
  "proxy:doctor": "node apps/proxy/dist/cli.js --config ./config.local.jsonc doctor",
  "proxy:stop": "node apps/proxy/dist/cli.js --config ./config.local.jsonc stop"
}
```

Document the local workflow as:

```sh
pnpm build
pnpm proxy:start
pnpm proxy:status
pnpm proxy:open
pnpm proxy:doctor
pnpm proxy:stop
```

## Acceptance Criteria

- Docs explain when `token-shuffle` is available as a binary.
- Local development docs use `pnpm proxy:*` scripts instead of raw node commands.
- Build prerequisites are clear.
- Existing installed CLI examples are preserved where appropriate.
- No docs imply that `token-shuffle` is globally available before installation or linking.

## Files Likely Affected

- `package.json`
- `README.md`
- `docs/getting-started/README.md`
- `docs/getting-started/configuration.md`
- `docs/getting-started/web-ui.md`
- `docs/getting-started/agents/opencode.md`
- `docs/getting-started/agents/pi.md`
- `docs/compatibility.md`

## Related ADRs

- ADR-0003: OpenAI-Compatible First
- ADR-0007: Workstation Distribution
- ADR-0008: Local Authentication and Configuration
- ADR-0010: Execution and Retry Semantics

## Implementation Notes

Preserve installed CLI examples, but label them clearly.

Prefer local `pnpm proxy:*` scripts for contributor workflows.

## Self-Review Checklist

- [ ] Can a contributor start the proxy from a repo checkout?
- [ ] Are status, open, doctor, and stop documented?
- [ ] Is the installed CLI distinguished from local development?
- [ ] Are scripts added without removing existing scripts?
- [ ] Is `config.local.jsonc` used consistently?

## Resolution

Completed for v0.5.

Implementation follows the suggested root scripts. User documentation now
distinguishes packaged/linked CLI commands from repository-checkout commands;
the project does not claim a globally installed binary exists today.

Files changed:

- `package.json`
- `README.md`
- `docs/getting-started/README.md`
- `docs/getting-started/configuration.md`
- `docs/getting-started/web-ui.md`
- `docs/erp/ERP-0007-cli-developer-experience.md`

Validation:

- root script names map directly to the built CLI;
- configuration consistently uses `config.local.jsonc`;
- installed syntax remains documented with an availability qualifier.

Commit: `docs(cli): clarify repository and installed workflows`
Release: v0.5.0
