# Package and module map

This document defines ownership and dependency direction for Token Shuffle. It
distinguishes a logical module from a physical workspace package: a boundary can
be enforced inside an application before it earns the maintenance cost of a
separate package.

## Design principles

- One owner exists for each business rule.
- Dependencies point toward provider-neutral domain concepts.
- Wire contracts, domain contracts, event schemas, and persistence records are
  related but not one universal type system.
- Untrusted data is validated at ingress, provider, configuration, and storage
  boundaries.
- Provider-specific behavior remains isolated without flattening meaningful
  provider differences.
- Context policies produce immutable results and explainable decisions.
- Routing and context preparation do not depend directly on one another.
- The execution coordinator owns runtime sequencing.
- A package is extracted only after real consumers prove a stable boundary.
- Circular dependencies are prohibited.

## Initial physical structure

The v0.1 repository intentionally remains small:

```text
apps/
  proxy/             Fastify entry point and initial internal modules
  web/               Local dashboard boundary
  desktop/           Added later: thin Tauri workstation shell

packages/
  core/              Provider-neutral domain rules and accounting
```

Inside `apps/proxy`, the gateway, execution coordinator, OpenAI-compatible
protocol handling, initial provider adapter, and local persistence begin as
separate internal modules. They are not separate packages merely because they
have different names.

## Current ownership

### `packages/core`

Owns provider-neutral rules:

- canonical inference concepts needed by more than one boundary;
- token-impact accounting and count provenance;
- immutable policy decisions;
- provider capability and execution-attempt concepts;
- ports for tokenization, providers, artifacts, events, and cache access when
  those ports become necessary.

It must not import Fastify, SQLite implementations, provider SDKs, environment
configuration, or UI code.

It must not become a universal contract package. Public HTTP schemas, versioned
event schemas, and provider wire representations may refer to core concepts but
retain separate ownership.

### `apps/proxy`

Owns the local executable and composition root:

- process lifecycle and loopback binding;
- Fastify gateway and OpenAI-compatible ingress;
- runtime configuration and secret resolution;
- execution coordination;
- initial protocol and provider implementations;
- initial SQLite repositories;
- dashboard API and static asset serving;
- graceful shutdown and diagnostics.

HTTP handlers translate and validate. They do not decide routing, mutate
context, calculate savings, or implement retries.

### `apps/web`

Owns the local dashboard. It consumes only the gateway API and must not read
SQLite files or internal event tables directly.

### Future `apps/desktop`

Owns the Tauri workstation shell, tray, updater, native credentials, and proxy
sidecar supervision. It contains no proxy business logic and is added only at
the workstation-distribution roadmap stage.

## Execution coordinator

Pipeline orchestration is application logic, not gateway logic. The coordinator
owns:

- request and session correlation;
- baseline measurement;
- candidate route planning;
- candidate-specific context preparation;
- response-cache eligibility and lookup;
- provider attempt lifecycle;
- retry and failover execution;
- cancellation and streaming state;
- event emission and asynchronous persistence.

The coordinator depends on interfaces; provider, storage, tokenizer, and cache
implementations are supplied by the composition root.

## Logical modules

These modules begin internally and may later become packages.

### Contracts and boundary schemas

Own versioned gateway API and event schemas plus runtime validation. Domain
types are not automatically wire schemas. Provider extensions and unknown
fields are preserved where possible instead of being discarded to fit a lowest
common denominator.

Extraction trigger: a second application or independently versioned consumer
needs the schemas.

### Context policies

Own immutable context construction policies:

- deterministic redundancy removal;
- tool-output compression;
- tool-definition selection;
- structured compaction;
- retrieval selection;
- candidate-specific token budgeting.

Artifact storage, retrieval indexes, and tokenizers are dependencies behind
ports, not responsibilities of the policy module. Every policy returns a new
context and a decision record; it does not mutate the canonical request.

Extraction trigger: the first active transform establishes a reusable policy
contract with independent domain tests.

### Route planner

Owns deterministic candidate evaluation:

- provider and model eligibility;
- required capabilities;
- context-window constraints;
- cost/quality policy evaluation;
- ordered candidate plans;
- reasons for excluding candidates.

It does not prepare context, call providers, or perform retries. Determinism
means the same recorded inputs and policy version produce the same candidate
plan; live health, price, and capability observations are explicit inputs.

Extraction trigger: more than one viable upstream target makes routing a real
decision rather than configuration.

### Provider adapters

Own provider-boundary behavior:

- authentication header attachment using resolved secrets;
- request translation;
- streaming and cancellation;
- tool-call representation;
- provider error classification;
- response and usage normalization;
- provider capability reporting.

Adapters accept a prepared request and explicit target. They do not choose a
route, semantically change context, store credentials, or alter canonical
contracts.

Extraction trigger: a second provider or protocol family proves the shared
adapter interface. Provider families may remain separate packages if their
semantics differ materially.

### Local store

Owns SQLite migrations and repositories for:

- immutable execution events;
- externalized artifacts and summaries;
- eligible exact-response cache entries;
- dashboard projections;
- retention deletion.

Accounting stays in core, replay orchestration stays in the application layer,
and the event repository only persists and reads events. One local-store owner
prevents several packages from independently controlling the same database.

Extraction trigger: the event, artifact, and retention schemas stabilize enough
to test independently of the proxy.

### Response cache

Owns canonical fingerprint construction, eligibility rules, lookup, expiry, and
invalidation. Storage is supplied by the local-store repository.

The cache key includes the prepared request, target, relevant execution
parameters, authorization/environment scope, and policy versions. Cache lookup
is coordinated after route and context preparation because those decisions are
part of response identity.

Extraction trigger: serving exact cached responses becomes an enabled feature,
not merely an observed eligibility metric.

### Event projections and replay

Event persistence is separate from interpretation:

- core accounting calculates token impact;
- the local store appends events;
- projections calculate dashboard read models;
- the application layer orchestrates replay.

This prevents the event repository from becoming a second business-logic layer.

## Eventual package candidates

If extraction triggers are met, the repository may evolve toward:

```text
packages/
  core/
  contracts/
  application/
  context/
  routing/
  providers-*/
  local-store/
```

This is a possible destination, not a scaffold checklist. New packages require
an ADR or a documented extraction trigger, at least two meaningful consumers or
an independently testable operational boundary, and no circular dependency.

An application entry point belongs under `apps/`. A future CLI therefore belongs
at `apps/cli`, or remains commands within `apps/proxy`; it is not a library
package.

Do not create a general `common` package. Utilities remain with the domain that
owns their semantics until a narrow, stable shared abstraction is demonstrated.

## Dependency direction

```text
apps/proxy composition root
  |-- gateway ----------> application coordinator
  |                            |-- context ----> core
  |                            |-- routing ----> core
  |                            `---------------> core ports
  |-- provider adapters ----------------------> core ports
  |-- local store ----------------------------> core ports
  `-- configuration

boundary contracts --------------------------> core concepts
apps/web ------------------------------------> gateway API
```

Arrows mean “may import or consume.” Core never imports an outer adapter.
The composition root constructs implementations and supplies them to the
coordinator; the coordinator depends only on their ports.

## Candidate-specific runtime flow

```text
client
  |
  v
ingress validation and normalization
  |
  v
execution coordinator
  |
  +--> baseline measurement
  |
  +--> candidate route plan
  |
  +--> context preparation for candidate
  |
  +--> response-cache eligibility and lookup
  |
  +--> provider adapter attempt
           |
           +-- failure before committed response --> next candidate
           |                                      and re-prepare context
           |
           +-- streamed response --> normalize, account, emit events
  |
  v
gateway serialization --> client
```

A failover target may use a different tokenizer, context window, tool format, or
provider capability. Context prepared for one candidate is never blindly reused
for another.

## Development order

Development proceeds in tested vertical slices rather than completing every
lower layer first:

1. one ingress protocol and one upstream adapter;
2. byte-preserving buffered forwarding;
3. streaming, cancellation, and provider-error pass-through;
4. observation events and accounting;
5. SQLite persistence and retention;
6. evidence dashboard;
7. first deterministic context policy;
8. second provider or protocol to prove adapter boundaries;
9. candidate routing and failover.

## See also

- [Architecture overview](overview.md)
- [Request-flow walkthroughs](request-flows.md)
- [Evolutionary package-boundary ADR](decisions/0006-evolutionary-package-boundaries.md)
- [Change workflow](../contributing/workflow.md)
