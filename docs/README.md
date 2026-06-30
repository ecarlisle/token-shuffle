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

The user guides describe the intended v0.1–v0.2 experience. The repository is
currently v0.0: inference proxying and the web dashboard are not implemented
yet. Availability notices in each guide prevent planned commands from being
mistaken for current behavior.

## Product and delivery

- [Vision](vision.md)
- [Token economics](product/token-economics.md)
- [Compatibility](compatibility.md)
- [Roadmap](roadmap.md)
- [Changelog](../CHANGELOG.md)

## Architecture

- [Architecture overview](architecture/overview.md)
- [Package and module map](architecture/package-map.md)
- [Technology stack](architecture/technology-stack.md)
- [Architecture decisions](architecture/decisions/README.md)

## Development

- [Contributing](../CONTRIBUTING.md)
- [Change workflow](contributing/workflow.md)
- [Testing strategy](testing/strategy.md)

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
