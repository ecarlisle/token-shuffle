# Use the web UI

> **Availability:** Included in v0.2.0.

The dashboard is served by the local proxy and is accessible only from the same
workstation by default.

Open it with:

```sh
token-shuffle open
```

The command opens a browser with a two-minute, single-use bootstrap code in the
URL fragment. Token Shuffle exchanges it for an eight-hour `HttpOnly`,
`SameSite=Strict` administrative cookie and removes the fragment from browser
history. The local agent bearer token cannot read dashboard history.
Administrative sessions also end when the proxy restarts.

For environments where the CLI cannot launch a browser:

```sh
token-shuffle open --no-browser
```

Copy the printed URL into a browser on the same workstation. Opening
`http://127.0.0.1:3210/` directly shows an administrative-session prompt without
revealing history.

## Overview

The implemented overview shows:

- sessions and request counts;
- input and output tokens;
- literal input tokens avoided;
- provider cache reads, kept separate from reduction;
- average request latency;
- provider-reported versus estimated count provenance;
- persistence health, dropped-event count, and raw-content retention state.

Values from different categories are not combined into one savings number.
Cost estimates, cache-write reporting, inference avoided through response reuse,
and proxy-versus-upstream latency attribution remain planned.

## Session and request details

Select a session to see its sequence of requests. Select a request to inspect:

- selected provider and model;
- measured request structure and token provenance;
- ordered lifecycle, active-policy, and shadow-policy events;
- baseline, forwarded, and optimization token counts;
- provider cache reads as a separate category;
- status and latency.

In v0.3, request replay shows baseline, final forwarded, optimization, and net
token counts. Session detail aggregates net reduction and policy retry counts so
a smaller individual request is not silently promoted when session behavior
regresses. Diagnostics previews each effective policy, its limits, mode, and
global kill-switch state.

Raw capture is not enabled in v0.2. Structural replay therefore shows
measurements and lifecycle decisions without reconstructing content that was
intentionally not retained.

New persisted events update the open dashboard through an authenticated SSE
connection. The browser then refreshes affected event-backed queries.

## Privacy controls

Raw prompt and response retention is off by default. The UI must make the
following visible:

- whether raw content retention is enabled;
- structural and redacted-error retention periods;
- event count and persistence health;
- immediate deletion for one request, one session, or all history.

The dashboard never displays provider credentials or the local proxy access
token. Changing retention periods requires editing local configuration and
restarting Token Shuffle; the dashboard deliberately does not rewrite
configuration.

## Diagnostics

Diagnostics show:

- proxy and database health;
- effective non-secret listener, mode, and retention configuration;
- active port and mode;
- supported ingress and provider capabilities;
- SQLite and event counts;
- version and retry behavior.

Diagnostic bundle export, update status, and log-path discovery remain later
work and are not represented as v0.2 capabilities.
