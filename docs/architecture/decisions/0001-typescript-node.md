# ADR 0001: TypeScript on Node.js

- Status: Proposed
- Date: 2026-06-29

## Context

The proxy must handle HTTP streaming, multiple provider adapters, event
accounting, and a local web UI. Development speed and maintainability matter
more initially than speculative CPU optimization. TypeScript is the maintainer's
most familiar language.

## Decision

Use strict TypeScript, Node.js 24 LTS, pnpm 11 workspaces, and Fastify for the local
HTTP process. Use React with Vite when dashboard implementation begins. Keep
tokenization behind a port so a native or WASM implementation can be introduced
without changing domain rules.

## Consequences

- Shared types and tooling can span proxy and UI.
- Node's streaming model fits an I/O-bound proxy.
- CPU-heavy tokenization must not block the event loop; profiling may lead to
  worker threads or a native component.
- Node 24 is pinned rather than the current non-LTS release.
