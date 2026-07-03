# Token Shuffle

Token Shuffle is an experimental local proxy between coding-agent clients and
inference providers. It is for developers who want to inspect how coding agents
use context and test conservative token-reduction policies without handing
prompt history to a remote control plane.

The project exists because token savings are easy to overstate. Token Shuffle
keeps literal reduction, provider-cache discounts, cost, latency, and quality
evidence separate so users can decide whether an optimization is worthwhile.

## What works today

The current stable release is **v0.6.0**:

- authenticated loopback OpenAI Chat Completions proxying;
- buffered and SSE forwarding with cancellation, backpressure, and no automatic
  inference retries;
- privacy-first structural events in local SQLite;
- a separately authenticated local evidence dashboard;
- opt-in deterministic tool-output reduction and exact redundancy removal;
- opt-in deterministic old-turn compaction with a global kill switch and
  bounded memory-only source recovery.
- opt-in persistent context artifacts with exact-ID/FTS5 retrieval and an
  explicit next-turn model recovery marker.
- optional native Anthropic Messages ingress alongside the OpenAI-compatible
  target, with protocol-aware usage/cache evidence.

OpenCode 1.17.11 and Pi 0.80.3 are verified in observe mode with OpenCode Zen.
Optimize-mode policies and other upstream combinations remain provisional. See
the [compatibility matrix](docs/compatibility.md) for the exact evidence.

## What is next

v0.7 is planned to add workstation packaging, followed by a trustworthy v1.0
distribution. See the
[roadmap](docs/roadmap.md).

## Start here

- **Try Token Shuffle:** [Getting started](docs/getting-started/README.md)
- **See what exists today:** [Capability status](docs/capabilities.md)
- **See tested client/provider combinations:** [Compatibility](docs/compatibility.md)
- **Understand the system:** [Architecture](docs/architecture/overview.md)
- **Understand the decisions:** [ADR index](docs/architecture/decisions/README.md)
- **See current and future milestones:** [Roadmap](docs/roadmap.md)
- **Browse all documentation:** [Documentation index](docs/README.md)
- **Contribute:** [Contributor guide](CONTRIBUTING.md)

## Product stance

- Observe before transforming.
- Separate literal token reduction, provider cache discounts, model-routing
  savings, and latency improvements.
- Preserve an explainable replay for each transformation.
- Keep payloads local by default and make retention explicit.
- Prefer quality over an impressive savings percentage.

## Try a repository checkout

Requirements: Node.js 24.15 or newer in the Node 24 LTS line and pnpm 11.

```sh
corepack enable
pnpm install
cp config.example.jsonc config.local.jsonc
export TOKEN_SHUFFLE_ACCESS_TOKEN="generate-a-long-random-value"
export TOKEN_SHUFFLE_FINGERPRINT_KEY="generate-an-independent-random-value"
export UPSTREAM_API_KEY="your-provider-api-key"
pnpm build
pnpm proxy:start
pnpm proxy:status
```

The `token-shuffle` binary name is available only from a packaged or explicitly
linked installation; repository checkouts use the `pnpm proxy:*` scripts. See
the [getting-started instructions](docs/getting-started/README.md).

Before contributing, run `pnpm check` and read the
[change workflow](docs/contributing/workflow.md). Coding agents must also follow
[AGENTS.md](AGENTS.md).

## Repository map

```text
apps/proxy/       Local HTTP/SSE proxy, CLI, observation, and persistence
apps/web/         React evidence dashboard
packages/core/    Provider-neutral domain rules and metrics
docs/             Vision, ADRs, architecture, testing, and roadmap
```
