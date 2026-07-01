# Use the web UI

> **Availability:** The first v0.2 development slice is implemented. It includes
> secure administrative sign-in and the read-only overview. Features described
> below that are not part of that overview remain planned.

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

## Session and request details (planned)

Open a session to see its sequence of requests. A request detail explains:

- selected provider and model;
- baseline structure and token sources;
- ordered policy decisions;
- forwarded structure;
- optimization work and token cost;
- retries, failover, and cache decisions;
- streamed usage reported by the provider;
- warnings or incomplete measurements.

When replay capture is enabled, the detail page provides a redacted before/after
view. Without capture, it shows structural metadata rather than reconstructing
content that was intentionally not retained.

## Privacy controls (planned)

Raw prompt and response retention is off by default. The UI must make the
following visible:

- whether capture is currently enabled;
- when it expires;
- which sessions contain raw content;
- storage usage and retention policy;
- an immediate delete action;
- export contents before an export is created.

The dashboard never displays provider credentials or the local proxy access
token.

## Diagnostics (planned)

Diagnostics show:

- proxy and database health;
- effective non-secret configuration and its source;
- active port and mode;
- supported ingress and provider capabilities;
- recent redacted errors;
- version and update status;
- paths to logs, configuration, and data.

Copyable diagnostic bundles exclude raw content and secrets unless the user
explicitly reviews and includes additional data.
