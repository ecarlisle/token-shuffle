# Token Shuffle

Token Shuffle is an experimental local proxy between coding-agent clients and
inference providers. Its purpose is to make context use visible, reduce genuinely
unnecessary input where that can be done safely, and show enough evidence for a
user to judge every optimization.

The project is in **v0.1 development**. The current executable implements an
authenticated, observe-only, buffered Chat Completions forwarding slice. It is
not a v0.1 release: streaming, persistence, measurement, CLI commands, and the
dashboard are still absent.

## Documentation

- **Application users:** [Getting started](docs/getting-started/README.md)
- **Compatibility:** [Supported clients, providers, and features](docs/compatibility.md)
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
apps/proxy/       Local HTTP proxy and buffered forwarding slice
apps/web/         Reserved boundary for the local dashboard
packages/core/    Provider-neutral domain rules and metrics
docs/             Vision, ADRs, architecture, testing, and roadmap
```
