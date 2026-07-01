# AGENTS.md

This file applies to the entire Token Shuffle repository. It translates the
accepted product and architecture decisions into day-to-day guardrails for
coding agents.

## Mission

Token Shuffle is a local workstation proxy between coding agents and inference
providers. It observes context use, measures it honestly, and eventually applies
explicit, explainable policies that reduce unnecessary tokens without hiding
quality loss.

Optimize for trustworthiness before feature breadth:

- preserve inference behavior;
- keep credentials and prompt content private;
- distinguish tokens, cache discounts, cost, and latency;
- make every transformation inspectable;
- fail visibly rather than duplicate an inference.

## Current status

The stable release is **v0.2.0**. **v0.3 is planned but not yet implemented.**

- The executable exposes authenticated status and buffered/streaming
  `POST /v1/chat/completions` forwarding.
- Structural observations persist to SQLite without raw prompt/response content.
- OpenCode 1.17.11 and Pi 0.80.3 with OpenCode Zen are verified. Other upstream
  combinations remain provisional until their matrix entries pass.
- The dashboard implements separate administrative authentication, event-backed
  overview/detail views, structural replay, live SSE invalidation, diagnostics,
  and immediate evidence deletion.
- Deterministic shadow-policy events never mutate forwarded requests or claim
  hypothetical scope as realized savings.
- The active runtime baseline is Node.js 24.15+ and TypeScript 6.

Do not describe a planned capability as implemented.

## Read before changing code

Start at:

1. [README.md](README.md)
2. [Documentation index](docs/README.md)
3. [Roadmap](docs/roadmap.md)
4. [Architecture overview](docs/architecture/overview.md)
5. [Architecture decisions](docs/architecture/decisions/README.md)
6. [Testing strategy](docs/testing/strategy.md)
7. [Change workflow](docs/contributing/workflow.md)

For proxy work, also read:

- [Compatibility contract](docs/compatibility.md)
- [Technology stack](docs/architecture/technology-stack.md)
- [Package map](docs/architecture/package-map.md)
- ADRs 0008–0012 for authentication, fidelity, retries, identity, and limits.

If a requested change conflicts with an accepted ADR, identify the conflict
before implementation. Supersede the ADR explicitly; do not quietly drift.

## Scope discipline

- Work in the current roadmap milestone unless the user explicitly expands
  scope.
- Prefer a complete vertical slice over unused abstractions.
- Do not implement future transforms while building the transparent observer.
- Do not create a workspace package because a module has a distinct name.
- Follow extraction triggers in the package map.
- Do not introduce a plugin system, generic gateway, remote control plane,
  vector database, or team feature without an accepted decision.
- Do not add external telemetry.

## Architecture boundaries

### `packages/core`

Owns provider-neutral domain rules, accounting, decisions, event concepts, and
ports. It must not import Fastify, provider SDKs, SQLite implementations,
environment configuration, or UI code.

### `apps/proxy`

Owns process lifecycle, Fastify ingress, the execution coordinator, initial
provider/protocol implementations, configuration, and initial local storage.

HTTP handlers validate and translate. They do not contain routing, accounting,
retry, context-policy, or persistence business rules.

### `apps/web`

Owns the dashboard and consumes only the gateway API. It never opens SQLite or
imports server implementation details.

### Execution coordinator

Owns request lifecycle, measurement, candidate preparation, cache eligibility,
provider attempts, cancellation, event emission, and future policy sequencing.
Adapters implement ports; they do not choose routes or mutate domain contracts.

## Non-negotiable proxy guardrails

### Observe-mode fidelity

For supported v0.1 requests:

- retain raw valid JSON body bytes and a separate parsed measurement view;
- forward the original body bytes without reserialization;
- do not inject defaults, usage options, or measurement fields;
- do not rewrite model IDs;
- do not reorder, remove, or reinterpret unknown fields;
- do not let shadow policies change the forwarded request.

Headers follow the explicit security policy and are not byte-preserved:

- consume local authorization and never forward it;
- remove hop-by-hop, host, length, cookie, origin, and internal headers;
- attach upstream authentication separately;
- forward only documented safe or configured provider headers.

For responses:

- preserve buffered status and body bytes;
- preserve SSE event order, names, data payloads, boundaries, and terminal events;
- propagate backpressure and cancellation;
- never promise TCP chunk-boundary or packet-timing fidelity;
- do not buffer an entire SSE response.

### Errors and retries

- v0.1 performs no automatic inference retries or failover.
- Provider errors retain provider status and body.
- Token Shuffle errors use the distinct documented error envelope.
- Never retry after response commitment.
- Never retry because measurement, logging, persistence, or projection failed.
- Client cancellation aborts upstream work.
- Stopping the process aborts active requests without restarting them.

Future retries require a new ADR.

### Authentication and secrets

- Bind only to explicit loopback addresses.
- Require the local bearer token on agent-facing routes.
- Agent tokens do not authorize administration or readable history.
- Never forward the local bearer token upstream.
- Never persist provider credentials.
- Never accept literal secrets in normal configuration or secret CLI flags.
- Never log secrets, authorization headers, raw prompts, or raw responses.
- Remote upstreams require HTTPS.
- HTTP upstreams are allowed only when explicitly configured on loopback.
- Upstream URLs come from validated configuration, never inference requests.
- Do not enable wildcard CORS.

Use `unknown` for untrusted data until boundary validation succeeds. Redact
before an object reaches logging or event persistence.

### Privacy and retention

- Raw prompt and response retention is off by default.
- Structural events default to 30-day retention.
- Redacted error events default to 14-day retention.
- Diagnostic raw capture is explicit, scoped, visible, and expiring.
- Cache retention is separate from event retention.
- Request-level deletion must remain possible even when sessions are inferred.
- Fixtures contain synthetic data only.

### Identity and events

- Every request, attempt, and event has its own identifier.
- Event schemas are versioned independently from SQLite rows.
- Request-level measurements are authoritative.
- Session grouping follows the accepted precedence rules.
- Heuristic grouping is labeled `inferred`.
- Internal session headers are consumed locally and not forwarded.
- Heuristic sessions never grant authority or extend retention.

### Resource limits

Keep accepted defaults visible and tested:

- request body: 16 MiB;
- request headers: 16 KiB;
- concurrent inference requests: 16;
- upstream connection timeout: 10 seconds;
- response-header timeout: 5 minutes;
- stream idle timeout: 2 minutes;
- no total inference timeout by default;
- single SSE event: 8 MiB.

Reject overload explicitly with documented `413`, `429`, or timeout errors.
Queues must be bounded by count and bytes. Do not solve overload with unbounded
buffering.

## Measurement guardrails

Keep these categories separate in code, events, UI, tests, and documentation:

- baseline input tokens;
- forwarded input tokens;
- literal input tokens avoided;
- optimization tokens;
- net tokens avoided;
- inference avoided by response reuse;
- provider cache reads/writes;
- estimated money saved;
- proxy and upstream latency.

Every token count carries provenance:

- provider-reported;
- provider tokenizer;
- compatible tokenizer;
- estimate.

Do not:

- count provider-cache discounts as tokens avoided;
- count model routing as token reduction;
- add savings from overlapping policies;
- omit tokens spent creating summaries or selections;
- promote a policy using request-level savings alone when session-level usage
  increased.

## TypeScript and dependency rules

- Use strict TypeScript and ESM.
- Node-targeted imports follow `NodeNext` conventions, including `.js` specifiers
  for emitted relative imports.
- Prefer immutable values and explicit result/error types.
- Use `AbortSignal` through every cancellable boundary.
- Avoid `any`; when unavoidable, isolate and justify it at a boundary.
- Keep synchronous database work off the proxy event loop.
- Use structured Pino logging rather than `console.log` in application code.
- Prefer platform APIs and existing dependencies over adding packages.
- Explain every new runtime dependency in the change.
- Do not add provider SDKs to the transparent hot path.
- Do not add Nx or Turborepo without build measurements and an ADR.
- Do not introduce a generic `common` package.

## Testing requirements

Every behavior change needs the narrowest useful automated test.

Proxy work must consider:

- raw request equality and unknown fields;
- safe header replacement;
- buffered and SSE fidelity;
- slow consumers and backpressure;
- cancellation before and after response commitment;
- provider and Token Shuffle error distinction;
- authorization stripping and secret redaction;
- zero automatic retries;
- resource boundaries and queue overflow;
- event ordering and count provenance;
- explicit versus inferred sessions;
- storage failure without inference duplication.

Use real temporary SQLite databases for persistence tests and a purpose-built
fake provider for protocol tests. Never place real credentials or proprietary
prompts in fixtures.

Do not weaken, delete, or skip a failing test merely to make a change pass.
Characterize intentional limitations in tests and documentation.

## Documentation requirements

Code, tests, and meaningful documentation normally change together.

- Root `README.md` remains the front door.
- Update `docs/README.md` when adding or moving documentation.
- User behavior belongs under `docs/getting-started/`.
- Durable architecture choices require an ADR.
- Update `docs/compatibility.md` only from tested evidence.
- Commands and configuration examples are public contracts.
- Mark planned behavior by release until it exists.
- Update `CHANGELOG.md` for user-visible or architectural changes.
- Do not make ritual documentation edits that convey no new information.

Documentation-only changes do not require new code tests, but examples and links
must still be validated.

## Required verification

Before handing off a completed change:

```sh
pnpm check
pnpm build
```

Also run the relevant integration, browser, migration, replay, or packaging
suite once it exists.

For documentation changes:

- run `git diff --check`;
- verify relative Markdown links;
- parse JSON and JSONC examples;
- run `pnpm check`.

If a required check cannot run, report exactly what was not verified and why.

## Git and workspace hygiene

- Inspect `git status` before editing.
- Preserve unrelated and pre-existing user changes.
- Do not use destructive Git commands.
- Do not commit `node_modules`, `dist`, coverage, databases, logs, secrets, or
  local package stores.
- Keep commits focused and use imperative conventional subjects:
  `type(scope): outcome`.
- Commit a completed, verified project change unless the user requests a
  review-only or uncommitted handoff.
- Never rewrite user-owned history without explicit permission.

## Definition of done

A change is done when:

- it satisfies the requested user outcome;
- it stays within the current roadmap and accepted decisions;
- security, privacy, fidelity, cancellation, and failure behavior are explicit;
- tests cover new behavior or an intentional limitation;
- documentation and compatibility claims match reality;
- required checks pass;
- the working tree contains no accidental artifacts;
- the commit message describes the outcome.
