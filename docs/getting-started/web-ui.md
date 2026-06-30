# Use the web UI

> **Availability:** The web UI begins in v0.2. It is not present in v0.1.

The dashboard is served by the local proxy and is accessible only from the same
workstation by default.

Open it with:

```sh
token-shuffle open
```

Or visit:

```text
http://127.0.0.1:3210/
```

The Tauri desktop shell opens the same application in a native window.

## Overview

The overview shows:

- sessions and request counts;
- baseline and forwarded input tokens;
- literal and net tokens avoided;
- inference avoided through eligible response-cache hits;
- provider cache reads and writes, separately;
- estimated provider cost and cost avoided;
- proxy and upstream latency;
- measurement provenance and uncertainty.

Values from different categories are not combined into one savings number.

## Session and request details

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

## Privacy controls

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

## Diagnostics

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
