# ADR 0001: TypeScript on Node.js

- Status: Accepted
- Date: 2026-06-29

## Context

The proxy must handle HTTP streaming, multiple provider adapters, event
accounting, and a local web UI. Development speed and maintainability matter
more initially than speculative CPU optimization. TypeScript is the maintainer's
most familiar language.

## Decision

Use strict ESM TypeScript 6, Node.js 24 LTS with 24.15 as the minimum supported
patch, pnpm 11 workspaces, Fastify 5, and an explicit Undici dependency for the
local proxy. Use TypeBox/Ajv for runtime boundary schemas and Pino for redacted
structured logs.

Use React 19.2 with Vite 8 when dashboard implementation begins. Keep
tokenization behind a port so TypeScript, native, or WASM implementations can be
introduced without changing domain rules.

The complete selection and phased adoption policy is defined in the
[technology stack](../technology-stack.md).

## Consequences

- Shared types and tooling can span proxy and UI.
- Node's streaming model fits an I/O-bound proxy.
- CPU-heavy tokenization must not block the event loop; profiling may lead to
  worker threads or a native component.
- Node 24 is pinned rather than the current non-LTS release.
- The foundation scaffold requires an explicit TypeScript 5.9-to-6 migration
  before implementation is considered aligned with this ADR.
- Direct provider HTTP adapters require more protocol tests than delegating to
  provider SDKs, but preserve pass-through control.
