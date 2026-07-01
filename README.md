# Token Shuffle

Token Shuffle is an experimental local proxy between coding-agent clients and
inference providers. Its purpose is to make context use visible, reduce genuinely
unnecessary input where that can be done safely, and show enough evidence for a
user to judge every optimization.

The current stable release is **v0.3.0**. Token Shuffle supports authenticated
buffered and streaming Chat Completions, privacy-first evidence, and explicitly
opted-in deterministic tool-output and exact-redundancy policies with a global
kill switch.

## Documentation

- **Application users:** [Getting started](docs/getting-started/README.md)
- **Compatibility:** [Supported clients, providers, and features](docs/compatibility.md)
- **Version history:** [Release-level project history](docs/version-history.md)
- **Documentation index:** [docs/README.md](docs/README.md)
- **Contributors:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Coding agents:** [AGENTS.md](AGENTS.md)

The getting-started guide covers the stable proxy, agent configuration, and
v0.2 evidence dashboard.

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
[getting-started instructions](docs/getting-started/README.md).

## Repository map

```text
apps/proxy/       Local HTTP/SSE proxy, CLI, observation, and persistence
apps/web/         React evidence dashboard
packages/core/    Provider-neutral domain rules and metrics
docs/             Vision, ADRs, architecture, testing, and roadmap
```
