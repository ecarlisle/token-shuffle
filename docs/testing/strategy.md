# Testing strategy

The risk is not merely returning the wrong JSON. A proxy can subtly corrupt an
SSE stream, inflate latency, miscount tokens, leak secrets, or save tokens while
making an agent worse. Tests are organized around those failure modes.

## Test layers

### Domain tests

Fast, table-driven tests cover accounting invariants, policy ordering,
provenance, redaction, and fail-open decisions. Property tests should verify that
disabled policies are identity functions and that counts are never silently
negative or fractional.

### Protocol contract tests

Recorded, synthetic fixtures cover request fields, unknown-field preservation,
tool calls, provider errors, usage metadata, malformed streams, and disconnects.
Fixtures must contain no real secrets or proprietary prompts.

### Proxy integration tests

An in-process fake provider verifies:

- byte and SSE event preservation in observe mode;
- time-to-first-byte and streaming without full buffering;
- abort propagation;
- retries are never introduced invisibly;
- no retry occurs after a response is committed;
- failover re-prepares context for the next target's tokenizer, limits, and
  capabilities;
- measurement/storage failure still forwards traffic;
- credentials and raw bodies do not enter default logs/events.

### Replay and quality tests

Representative coding tasks run baseline and candidate policies against pinned
models where possible. Deterministic project tests are preferred over an
LLM-as-judge. Compare task completion, number of turns, total session tokens,
tool-call correctness, latency, and provider cost.

### UI end-to-end tests

Once the dashboard exists, Playwright verifies metric labels, provenance,
before/after replay, redaction, retention controls, and empty/error states.

### Documentation contract tests

User configuration snippets are fixtures, not decorative pseudocode. Tests
parse the Token Shuffle JSONC, OpenCode JSONC, and Pi JSON examples and verify
that documented route paths, environment-variable names, CLI commands, and
defaults match the supported release. External agent compatibility fixtures are
reviewed when the tested agent version changes.

### Workstation distribution tests

Platform CI smoke-tests the packaged Tauri shell and Node sidecar on supported
macOS, Windows, and Linux targets. It verifies startup, single-instance behavior,
port discovery, tray/window independence, graceful shutdown, signed update
verification, migration, crash recovery, and uninstall retention choices.

The proxy's protocol and domain suites remain runnable without Tauri.

## Definition of done

A code change is complete when:

- behavior has the narrowest useful automated test;
- protocol changes have a contract fixture;
- user-visible or architectural behavior is documented;
- privacy and failure behavior were considered;
- `pnpm check` passes;
- the changelog is updated for a user-visible change.

Coverage percentage is a diagnostic, not the goal. Critical accounting,
redaction, policy, and streaming branches should approach exhaustive behavioral
coverage.
