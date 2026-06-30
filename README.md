# Token Shuffle

Token Shuffle is an experimental local proxy between coding-agent clients and
inference providers. Its purpose is to make context use visible, reduce genuinely
unnecessary input where that can be done safely, and show enough evidence for a
user to judge every optimization.

The current release is **v0.1.0**. The transparent observer supports
authenticated buffered and streaming Chat Completions, structural measurement,
privacy-first SQLite events, and a headless CLI. OpenCode and Pi with OpenCode
Zen are verified live combinations; other combinations remain explicitly
provisional. The dashboard begins in v0.2.

## Documentation

- **Application users:** [Getting started](docs/getting-started/README.md)
- **Compatibility:** [Supported clients, providers, and features](docs/compatibility.md)
- **Version history:** [Release-level project history](docs/version-history.md)
- **Documentation index:** [docs/README.md](docs/README.md)
- **Contributors:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Coding agents:** [AGENTS.md](AGENTS.md)

The getting-started guide separates runnable development behavior from the
planned v0.1 and v0.2 user journey.

## Product stance

- Observe before transforming.
- Separate literal token reduction, provider cache discounts, model-routing
  savings, and latency improvements.
- Preserve an explainable replay for each transformation.
- Keep payloads local by default and make retention explicit.
- Prefer quality over an impressive savings percentage.

## Local development

Requirements: Node.js 24.15 or newer in the Node 24 LTS line and pnpm 11.

```sh
corepack enable
pnpm install
pnpm check
```

To run the proxy, create a configuration from
[`config.example.jsonc`](config.example.jsonc), export its two referenced
secrets, and follow the
[development instructions](docs/getting-started/README.md#current-development-slice).

## Repository map

```text
apps/proxy/       Local HTTP/SSE proxy, CLI, observation, and persistence
apps/web/         Reserved boundary for the local dashboard
packages/core/    Provider-neutral domain rules and metrics
docs/             Vision, ADRs, architecture, testing, and roadmap
```
