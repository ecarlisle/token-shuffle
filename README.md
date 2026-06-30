# Token Shuffle

Token Shuffle is an experimental local proxy between coding-agent clients and
inference providers. Its purpose is to make context use visible, reduce genuinely
unnecessary input where that can be done safely, and show enough evidence for a
user to judge every optimization.

The project is in **v0.0 — foundation**. The current executable is only a health
endpoint; it does not yet forward inference traffic.

## Documentation

- **Application users:** [Getting started](docs/getting-started/README.md)
- **Compatibility:** [Supported clients, providers, and features](docs/compatibility.md)
- **Documentation index:** [docs/README.md](docs/README.md)
- **Contributors:** [CONTRIBUTING.md](CONTRIBUTING.md)

The getting-started guide clearly marks planned v0.1 and v0.2 behavior. The
current v0.0 executable is not ready to receive agent inference traffic.

## Product stance

- Observe before transforming.
- Separate literal token reduction, provider cache discounts, model-routing
  savings, and latency improvements.
- Preserve an explainable replay for each transformation.
- Keep payloads local by default and make retention explicit.
- Prefer quality over an impressive savings percentage.

## Local development

Current scaffold requirements: Node.js 24 LTS and pnpm 11. The accepted
production minimum is Node.js 24.15; implementation alignment is tracked in the
roadmap.

```sh
corepack enable
pnpm install
pnpm check
pnpm dev
```

The development server exposes `GET /_token-shuffle/status` on
`http://127.0.0.1:3210`. It intentionally binds to loopback.

## Repository map

```text
apps/proxy/       Local HTTP proxy process (health endpoint only today)
apps/web/         Reserved boundary for the local dashboard
packages/core/    Provider-neutral domain rules and metrics
docs/             Vision, ADRs, architecture, testing, and roadmap
```
