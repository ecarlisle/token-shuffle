# Token Shuffle

Token Shuffle is an experimental local proxy between coding-agent clients and
inference providers. Its purpose is to make context use visible, reduce genuinely
unnecessary input where that can be done safely, and show enough evidence for a
user to judge every optimization.

The project is in **v0.0 — foundation**. The current executable is only a health
endpoint; it does not yet forward inference traffic.

## Product stance

- Observe before transforming.
- Separate literal token reduction, provider cache discounts, model-routing
  savings, and latency improvements.
- Preserve an explainable replay for each transformation.
- Keep payloads local by default and make retention explicit.
- Prefer quality over an impressive savings percentage.

Start with [the vision](docs/vision.md), [token economics](docs/product/token-economics.md),
and [the architecture](docs/architecture/overview.md). The
[roadmap](docs/roadmap.md) defines what belongs in each release.

## Local development

Requirements: Node.js 24 LTS and pnpm 11.

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

See [CONTRIBUTING.md](CONTRIBUTING.md) before making a code change.
