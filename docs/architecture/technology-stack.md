# Technology stack

This is the accepted target stack for Token Shuffle as a workstation
application. It describes the intended production system, not a requirement to
install every dependency during the foundation phase. Components are adopted
only when their roadmap capability begins.

## Product shape

The proxy is an independently runnable local service. A desktop shell may start,
monitor, and display it, but inference traffic must continue to work when the
dashboard window is closed.

```text
agent clients -- HTTP/SSE --> TypeScript proxy -- HTTP/SSE --> providers
                              |        |
                              |        `--> SQLite worker
                              |
                              `--> local REST/SSE API
                                         |
                                 browser or Tauri UI
```

This shape supports both technical users who prefer a CLI and workstation users
who expect an installer, tray icon, launch-at-login behavior, and signed updates.

## Runtime and language

| Concern | Choice | Notes |
| --- | --- | --- |
| Runtime | Node.js 24 LTS, minimum 24.15 | Pin the latest tested 24.x patch in builds |
| Language | TypeScript 6, strict ESM | Use `NodeNext` for Node code and `bundler` for the web |
| Workspace | pnpm 11 | Keep workspace build orchestration simple |
| Server | Fastify 5 | Gateway lifecycle, JSON Schema, injection tests |
| Upstream HTTP | Explicit `undici` dependency | Streaming, pools, timeouts, aborts, header control |
| Logging | Pino | Structured output with redaction at creation time |
| Correlation | `AsyncLocalStorage` | Request, session, plan, and attempt identifiers |

Node.js is appropriate because the hot path is predominantly streaming network
I/O. CPU-heavy tokenization, retrieval, compression, and database work must be
measured and moved to worker threads, native code, or WASM only when profiling
justifies it.

Node 24.15 is the minimum because it bundles SQLite 3.51.3, which contains the
WAL-reset corruption fix. The project follows Node 24 LTS patches rather than a
non-LTS current release.

TypeScript 6 is the production target. Migration from the foundation scaffold's
TypeScript 5.9 pin is a deliberate build change with its own verification; it is
not hidden inside this documentation decision.

## Protocol and validation

- Use TypeBox schemas with Fastify/Ajv at HTTP, configuration, event, and
  persistence boundaries.
- Generate OpenAPI 3.1 for the dashboard API from gateway schemas.
- Generate or consume dashboard client types from that public API rather than
  importing server implementation types.
- Keep internal domain types as plain strict TypeScript where runtime validation
  has already occurred.
- Preserve unknown and provider-specific fields whenever pass-through fidelity
  permits.
- Do not force every provider into a lowest-common-denominator schema.

Provider adapters use HTTP directly instead of making provider SDKs part of the
hot path. This keeps streaming frames, cancellation, headers, errors, tool calls,
and newly introduced provider fields under application control.

## Local storage

| Concern | Choice |
| --- | --- |
| Database | SQLite bundled with Node 24.15+ |
| Driver | Built-in `node:sqlite` behind a repository port |
| Concurrency | Dedicated database worker and one writer |
| Schema changes | Checked-in, explicit SQL migrations |
| Retrieval | SQLite FTS5 before embeddings |
| Query abstraction | Thin repositories; no ORM initially |

Startup checks must:

1. read `sqlite_version()` and reject unsafe WAL configurations;
2. enable foreign keys;
3. configure a bounded busy timeout and WAL checkpoint policy;
4. apply migrations transactionally;
5. verify expected schema and application metadata;
6. expose recovery diagnostics without logging stored content.

The database owns execution events, artifacts, summaries, eligible
exact-response cache entries, dashboard projections, and retention state. The
dashboard never opens the database directly.

`node:sqlite` is isolated behind a port because its Node API remains less mature
than SQLite itself. A tested `better-sqlite3` implementation is the fallback if
the built-in driver proves unreliable. An ORM such as Drizzle may be considered
only if repository query complexity outweighs the value of explicit SQL.

Do not introduce PostgreSQL, Redis, a remote database, a separate vector
database, or Docker as a workstation prerequisite.

## Dashboard

| Concern | Choice |
| --- | --- |
| UI framework | React 19.2 |
| Web build | Vite 8 |
| Server state | TanStack Query |
| Routing | TanStack Router |
| Large tables | TanStack Table |
| Charts | Apache ECharts |
| Accessible primitives | Radix UI |
| Styling | Tailwind CSS 4 with CSS-variable design tokens |
| Local UI state | React state first; Zustand only after demonstrated need |

The dashboard is a client-rendered SPA. It uses REST/JSON for bounded queries
and server-sent events for live execution updates. It does not need SSR, React
Server Components, GraphQL, Redux, or WebSockets initially.

Charts must disclose count provenance and keep literal tokens, provider-cache
discounts, estimated cost, inference avoided, and latency visually separate.

## Desktop distribution

Tauri 2 is the accepted workstation shell. It owns:

- tray icon and menu;
- start, stop, restart, and health display;
- optional launch at login;
- dashboard window lifecycle;
- signed installer and updater integration;
- OS credential-store integration when implemented;
- sidecar supervision and crash diagnostics.

The TypeScript proxy runs as a packaged Node sidecar. Rust remains a narrow
desktop-integration layer and contains no token accounting, context policy,
routing, provider, or persistence business logic.

The first v0.7 packaging spike evaluates `@yao-pkg/pkg`, the approach documented
by Tauri for Node sidecars, against the then-current Node single-executable
workflow. The sidecar contract must not depend on either packaging tool.

Development and early releases continue to support a standalone CLI plus browser
dashboard. Tauri adoption occurs after proxy behavior is stable enough that
desktop lifecycle work will not obscure protocol bugs.

Electron is the fallback only if a packaging spike demonstrates that the Tauri
sidecar creates unacceptable reliability or maintenance costs. Electron is not
the default because the product does not otherwise need a bundled Chromium
runtime. Node single-executable applications are not the primary distribution
foundation while that feature remains under active development.

## Configuration and secrets

Use a versioned JSONC configuration file in the operating system's application
data directory.

Precedence, from lowest to highest:

1. built-in defaults;
2. user configuration;
3. environment variables;
4. CLI flags.

Provider secrets are references rather than values in the normal configuration:

```jsonc
{
  "providers": {
    "openai": {
      "apiKey": { "fromEnv": "OPENAI_API_KEY" }
    }
  }
}
```

Production secrets must not be written to `.env`, SQLite, events, logs, replay
exports, or diagnostic bundles. Native credential storage is added through the
desktop shell without making core provider adapters depend on Tauri.

## Token-specific implementation

### Tokenization

Tokenization is a provider/model-family port:

- provider-reported usage is authoritative after execution;
- compatible local tokenizers support preflight budgeting;
- estimates remain visibly labeled;
- no tokenizer implementation is treated as universally correct.

Tokenizer libraries are selected and calibrated per model family during v0.1.
They may be pure TypeScript, WASM, or native without changing core accounting.

### Retrieval

Begin with SQLite FTS5 and deterministic signals:

- file paths;
- symbols and identifiers;
- exact terms;
- recency;
- artifact and session relationships.

Embeddings are added only when replay evidence shows lexical retrieval is
insufficient. If needed, prefer an optional local ONNX/WASM embedding model
before requiring a hosted service or vector database.

### Cache identity

Use Node's cryptographic primitives:

- HMAC-SHA-256 for scoped content fingerprints;
- a random per-installation key;
- canonical serialization and policy-version inputs;
- constant-time comparison where applicable.

Plain hashes must not allow offline discovery of likely prompt contents.

## Testing

| Layer | Technology |
| --- | --- |
| Unit and domain | Vitest |
| Property testing | fast-check |
| HTTP integration | Fastify injection and real in-process servers |
| Provider behavior | Purpose-built buffered and SSE fake provider |
| Storage | Real temporary SQLite databases |
| UI behavior | Testing Library |
| Browser E2E | Playwright |
| Load and overhead | autocannon plus Node performance metrics |
| Replay quality | Deterministic project fixtures and baseline comparisons |
| Distribution | macOS, Windows, and Linux packaged smoke tests |

Important suites include malformed and slow SSE, backpressure, cancellation,
response commitment, failover, migration from every released schema, corruption
recovery, secret redaction, cache eligibility, and full-session token outcomes.

## Development and release tooling

- Biome for formatting, import organization, and baseline linting.
- TypeScript for semantic type checking.
- `typescript-eslint` only for valuable rules requiring type information.
- Knip for unused exports and dependencies.
- markdownlint for documentation consistency.
- Renovate for grouped, reviewed dependency updates.
- GitHub Actions across macOS, Linux, and Windows.
- Signed release artifacts and a generated software bill of materials.
- No Nx or Turborepo until build measurements justify another orchestrator.
- Changesets only if independently versioned public packages are published.

Dependencies are exact in the lockfile. Major upgrades require their own change,
tests, documentation, and release note rather than being mixed into feature work.

## Local security baseline

- Bind explicitly to loopback addresses; never default to all interfaces.
- Serve the dashboard and API from the same origin.
- Do not enable wildcard CORS.
- Require a generated proxy access token on agent-facing inference routes;
  compatible clients send it as their configured API key.
- Authenticate local dashboard mutations with a random per-run or per-install
  session and validate `Origin`.
- Permit only explicitly configured upstream endpoints and guard against
  request-controlled SSRF; configured local providers such as Ollama remain
  possible.
- Strip hop-by-hop and local-only headers.
- Never forward dashboard credentials upstream.
- Apply restrictive permissions to configuration, database, logs, and exports.
- Redact before logging or event persistence.
- Treat imported configurations and replay files as untrusted.
- Sign desktop binaries and installers where the platform supports it, and
  always sign update metadata/artifacts.

## Adoption sequence

1. Node, TypeScript, pnpm, Fastify, Undici, and Vitest for the transparent proxy.
2. TypeBox boundary schemas, Pino redaction, and `node:sqlite` worker storage.
3. React, Vite, REST/SSE, and dashboard test tooling.
4. Deterministic token policies and calibrated tokenizer adapters.
5. FTS5 retrieval and optional local embeddings only if justified.
6. Tauri shell, installers, credential integration, and signed updates.

## Primary references

- [Node.js 24 LTS migration and support](https://nodejs.org/uk/blog/migrations/v22-to-v24)
- [Node.js 24.15 SQLite 3.51.3 update](https://nodejs.org/en/blog/release/v24.15.0)
- [Node.js SQLite API](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)
- [SQLite WAL-reset bug](https://www.sqlite.org/wal.html)
- [TypeScript 6](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [Fastify validation and serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)
- [React versions](https://react.dev/versions)
- [Vite 8](https://vite.dev/blog/announcing-vite8)
- [Tauri architecture](https://v2.tauri.app/concept/architecture/)
- [Tauri Node sidecars](https://v2.tauri.app/learn/sidecar-nodejs/)
- [Tauri updater](https://v2.tauri.app/plugin/updater/)
- [Node single-executable applications](https://nodejs.org/api/single-executable-applications.html)
- [Playwright](https://playwright.dev/)
- [Biome](https://biomejs.dev/)
