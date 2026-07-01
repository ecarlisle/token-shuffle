# Token Shuffle documentation

The repository root [README](../README.md) is the starting point for the
project. This page is the documentation index.

## Application users

1. [Getting started](getting-started/README.md)
2. [Configure Token Shuffle](getting-started/configuration.md)
3. Configure an agent:
   - [OpenCode](getting-started/agents/opencode.md)
   - [Pi Coding Agent](getting-started/agents/pi.md)
4. [Use the web UI](getting-started/web-ui.md)

The user guides describe the stable v0.4 proxy, evidence dashboard, and opt-in
deterministic reduction/compaction policies. Later retrieval behavior remains
separated by roadmap milestone.

## Product and delivery

- [Vision](vision.md)
- [Token economics](product/token-economics.md)
- [Capability status](capabilities.md)
- [Compatibility](compatibility.md)
- [Roadmap](roadmap.md)
- [Version history](version-history.md)
- [Changelog](../CHANGELOG.md)
- [v0.3 release validation](testing/v0.3-release-validation.md)
- [v0.4 release validation](testing/v0.4-release-validation.md)

## Architecture

- [Architecture overview](architecture/overview.md)
- [Package and module map](architecture/package-map.md)
- [Technology stack](architecture/technology-stack.md)
- [Architecture decisions](architecture/decisions/README.md)

## Development

- [Contributing](../CONTRIBUTING.md)
- [Coding-agent guardrails](../AGENTS.md)
- [Change workflow](contributing/workflow.md)
- [Testing strategy](testing/strategy.md)
- [v0.1 release validation](testing/v0.1-release-validation.md)

## Organization rules

- Root `README.md` remains the front door.
- User tasks live under `docs/getting-started/`.
- Product intent lives under `docs/product/` or top-level project documents.
- System structure and durable decisions live under `docs/architecture/`.
- Development process lives under `docs/contributing/` and `docs/testing/`.
- Commands and configuration examples must state the release in which they are
  available.
- User-visible behavior changes update the guide, tests, and changelog together.
- Links to external tool configuration should point to primary documentation and
  be reviewed when compatibility tests or dependency versions change.
