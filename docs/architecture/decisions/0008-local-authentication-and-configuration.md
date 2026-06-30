# ADR 0008: Local authentication and strict configuration

- Status: Accepted
- Date: 2026-06-29

## Context

Loopback services are reachable by other local processes and can be targeted by
malicious web pages, browser extensions, or DNS-rebinding techniques. Token
Shuffle also handles upstream provider credentials and may later expose
sensitive history, replay, configuration, and deletion operations.

Local agent credentials, provider credentials, and administrative dashboard
authority are different security boundaries. Configuration must remain
predictable enough that an invalid or missing security setting cannot silently
fall back to an unsafe mode.

## Decision

### Agent-facing authentication

Require `Authorization: Bearer <token>` on every agent-facing `/v1/*` route.
The token is resolved from `TOKEN_SHUFFLE_ACCESS_TOKEN`, compared in constant
time, and authorizes inference and model discovery only.

The incoming authorization header is consumed locally and never forwarded.
Provider adapters attach the independently configured upstream credential.

In v0.1, the redacted status endpoint may accept the same agent token because no
administrative mutation or readable history API exists.

### Administrative authentication

Before v0.2 exposes history or management operations, introduce a separate
administrative session. The CLI or desktop shell creates a short-lived,
single-use browser bootstrap code and exchanges it for an `HttpOnly`,
`SameSite=Strict` cookie. Persistent tokens do not appear in URLs.

Agent tokens never authorize configuration, replay, raw-content access,
retention changes, cache deletion, shutdown, or restart.

### Network policy

- Bind only to explicit loopback addresses in early releases.
- Reject wildcard, LAN, and public bindings.
- Disable wildcard CORS and validate origins for dashboard mutations.
- Reject browser-origin inference requests unless a future compatibility
  decision explicitly allows them.
- Permit only configured upstream endpoints.
- Require HTTPS for remote upstreams.
- Permit HTTP only for explicitly configured loopback upstreams.
- Do not accept an upstream URL from an inference request.

### Configuration

Use versioned JSONC with a required `configVersion`. Initial v0.1 configuration
supports one upstream and requires environment references for secrets.

Precedence is:

1. built-in defaults;
2. configuration file;
3. documented environment overrides;
4. non-secret CLI flags.

Unknown keys, missing secret variables, invalid URLs, unsafe binding, and
incompatible options are startup errors. Invalid explicit configuration never
falls back silently. Secret-valued CLI flags and literal secrets in the normal
configuration are prohibited.

Configuration does not hot-reload in v0.1. A port conflict is an error rather
than permission to select a random port that would invalidate agent settings.

`token-shuffle config validate` performs offline schema and security validation.
`token-shuffle doctor` performs runtime checks such as port availability,
database initialization, upstream TLS/authentication, and data-directory access.
Neither command prints resolved secrets.

## Consequences

- Users configure two credentials: a local agent token and an upstream provider
  credential.
- Agent configuration can be copied without exposing the provider credential.
- Dashboard administration requires a separate session design before v0.2.
- Local providers such as Ollama remain possible when explicitly configured.
- Configuration is less permissive but failures are deterministic and visible.
- Authentication, redaction, header replacement, URL policy, origin policy, and
  configuration precedence require integration tests.
