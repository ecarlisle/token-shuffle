# Configure Token Shuffle

> **Availability:** Implemented through v0.6.0. One primary OpenAI-compatible
> target and one optional Anthropic target may coexist.

## Configuration location

The installed application uses the operating system's user configuration
directory:

| Platform | Planned path |
| --- | --- |
| macOS | `~/Library/Application Support/Token Shuffle/config.jsonc` |
| Linux | `${XDG_CONFIG_HOME:-~/.config}/token-shuffle/config.jsonc` |
| Windows | `%APPDATA%\Token Shuffle\config.jsonc` |

Packaged or linked installations can use `token-shuffle config path` to show the
active default. In a repository checkout, run
`pnpm proxy:cli config path`. Override either form with
`--config /path/to/config.jsonc` or
`TOKEN_SHUFFLE_CONFIG=/path/to/config.jsonc`.

## Initial configuration

```jsonc
{
  "configVersion": 1,
  "mode": "observe",
  "server": {
    "host": "127.0.0.1",
    "port": 3210
  },
  "auth": {
    "accessToken": {
      "fromEnv": "TOKEN_SHUFFLE_ACCESS_TOKEN"
    }
  },
  "upstream": {
    "type": "openai-compatible",
    "baseUrl": "https://api.example-provider.com/v1",
    "apiKey": {
      "fromEnv": "UPSTREAM_API_KEY"
    },
    "compatibility": {
      "developerRole": "preserve"
    }
  },
  "storage": {
    "retainRawContent": false,
    "path": "/path/to/token-shuffle-events.sqlite",
    "contentFingerprintKey": {
      "fromEnv": "TOKEN_SHUFFLE_FINGERPRINT_KEY"
    },
    "structuralRetentionDays": 30,
    "errorRetentionDays": 14,
    "artifactRetentionDays": 7
  },
  "policies": {
    "killSwitch": false,
    "toolOutput": {
      "enabled": false,
      "collapseRepeatedLinesAfter": 3,
      "maximumInputCharacters": 65536
    },
    "exactRedundancy": {
      "enabled": false
    },
    "conversationCompaction": {
      "enabled": false,
      "minimumMessages": 12,
      "activeWindowMessages": 6,
      "maximumSourceCharacters": 256000
    },
    "retrieval": {
      "enabled": false,
      "maximumResults": 3,
      "maximumInjectedCharacters": 24000
    }
  }
}
```

Replace `baseUrl` with the provider's official OpenAI-compatible endpoint. The
primary target forwards the model ID supplied by the agent. v0.6 capability
selection is protocol-based; general model/provider routing remains later scope.

To enable native Anthropic Messages ingress at `POST /v1/messages`, add:

```json
"anthropicUpstream": {
  "type": "anthropic",
  "baseUrl": "https://api.anthropic.com/v1",
  "apiKey": { "fromEnv": "ANTHROPIC_API_KEY" },
  "anthropicVersion": "2023-06-01"
}
```

The two adapters coexist. Chat Completions selects the OpenAI-compatible target;
Messages selects Anthropic. Token Shuffle does not translate, retry, or fail
over between them. Native Anthropic clients may supply the local Token Shuffle
token as `x-api-key`; Token Shuffle consumes it and replaces it with the
configured Anthropic provider key.

`upstream.compatibility.developerRole` defaults to `preserve`. Set it to
`system` when the selected upstream/model rejects OpenAI `developer` messages,
including DeepSeek-compatible endpoints:

```json
"compatibility": {
  "developerRole": "system"
}
```

Token Shuffle still measures the original inbound request. The provider adapter
changes only each outbound message role from `developer` to `system`; message
content, names, other message fields, supported roles, and unrelated request
fields are retained. This configured mapping intentionally gives up byte-level
request fidelity for compatible dispatch and is independent of optimization
mode.

## Configuration rules

Unknown keys are errors. Missing secret variables, unsafe network settings, and
incompatible options prevent startup instead of falling back to defaults.

### Resource defaults

| Limit | Default |
| --- | ---: |
| Request body | 16 MiB |
| Request headers | 16 KiB |
| Concurrent inference requests | 16 |
| Upstream connection | 10 seconds |
| Response headers | 5 minutes |
| Stream idle | 2 minutes |
| Total inference | No default timeout |
| Single SSE event | 8 MiB |

The proxy accepts `limits.requestBodyBytes`,
`limits.requestHeaderBytes`, `limits.concurrentInferenceRequests`,
`limits.upstreamConnectTimeoutMs`, `limits.responseHeaderTimeoutMs`, and
`limits.responseBodyTimeoutMs`, and `limits.sseEventBytes`. Oversized requests receive `413`;
excess concurrency receives `429`. Token Shuffle never converts a timeout into
an automatic inference retry.

### `mode`

- `observe` forwards requests without semantic transformation while recording
  approved structural metrics.
- `optimize` permits only explicitly enabled v0.3 deterministic policies.

Observe mode is the default and the recommended starting point.

### `policies`

Both v0.3 policies default to disabled. Set `mode` to `optimize` and enable each
policy separately:

- `toolOutput` removes ANSI/non-semantic controls and replaces runs of repeated
  lines with the retained line plus an exact count marker;
- `exactRedundancy` removes only consecutive identical tool-result messages with
  the same `tool_call_id`.
- `conversationCompaction` replaces eligible old non-system turns with
  deterministic structured state. System/developer messages and the configured
  active window remain verbatim.
- `retrieval` stores eligible compacted turns and full tool outputs as local
  artifacts, then injects bounded session-scoped matches for an explicit
  `token_shuffle_retrieve("query")` marker.

`maximumInputCharacters` is a safety bound, not a truncation target. Tool output
larger than the limit bypasses the policy unchanged. `killSwitch: true` bypasses
all active policies without requiring other configuration changes. Restart the
proxy after changing policy configuration.

Conversation compaction applies only after `minimumMessages` is reached, only
when its source is within `maximumSourceCharacters`, and only when the complete
prepared request is smaller. Each summary contains source indexes, a
keyed HMAC-SHA-256 fingerprint, version, and uncertainty statement.

When compaction applies, Token Shuffle keeps the omitted source in a bounded memory-only
recovery snapshot for eight hours. It is available only through the separately
authenticated administrative API, is never written to SQLite, and disappears
on proxy restart. Deleting its request, session, or all history deletes the
snapshot immediately. With retrieval disabled, it is not available to the
model.

When `retrieval.enabled` is true, eligible source is also retained in SQLite for
`storage.artifactRetentionDays` (seven days by default). This is readable raw
context and changes the privacy posture. Persistence and lookup require an
explicit `X-Token-Shuffle-Session-Id`; inferred request sessions do not retain
artifacts. Exact artifact IDs are resolved before
FTS5 lexical matches. Results are limited by `maximumResults` and
`maximumInjectedCharacters`. The model can emit
`token_shuffle_retrieve("query")`; retrieval occurs when the client includes
that assistant turn in its next request. No hidden inference retry occurs.

### `server`

`host` must default to `127.0.0.1`. Non-loopback binding is unsupported in early
releases and must never be used as a quick fix for local connection trouble.

If port `3210` is occupied, select another loopback port and update both agent
and dashboard URLs.

### `auth`

The local access token and upstream API key are different credentials:

- `TOKEN_SHUFFLE_ACCESS_TOKEN` authenticates agents to the local proxy.
- `TOKEN_SHUFFLE_FINGERPRINT_KEY` scopes content identities used by compaction
  and retrieval. Keep this independent random value stable across restarts;
  Token Shuffle never persists or logs it.
- `UPSTREAM_API_KEY` authenticates Token Shuffle to the provider.
- `ANTHROPIC_API_KEY` is required only when `anthropicUpstream` is configured
  and is sent only as the Anthropic `x-api-key`.

Only environment-variable references belong in the configuration. Missing
variables are startup errors; Token Shuffle must not quietly run without local
authentication.

Literal secrets and secret-valued CLI flags are rejected. The access token
authorizes agent-facing inference routes only. Dashboard administration uses a
separate session beginning in v0.2.

### `storage`

`retainRawContent` defaults to `false`. With that setting, Token Shuffle stores
counts, timing, structural metadata, keyed fingerprints, and redacted decisions
without retaining readable prompts or responses.

Relative storage paths are resolved from the configuration file's directory,
not the shell's current working directory. The CLI can therefore be invoked
from any project without moving its database, PID, or dashboard bootstrap files.

Initial defaults retain structural execution events for 30 days and redacted
errors for 14 days. Retrieval artifacts use a separate seven-day default and
exist only while retrieval is enabled. Request, session, and history deletion
remove both events and their artifacts. Cache expiry is configured separately.

Enable raw capture only for a bounded diagnostic or replay session after
reviewing the content involved. The web UI must make capture state conspicuous.

## Precedence

From lowest to highest:

1. built-in defaults;
2. the user configuration file;
3. documented environment overrides;
4. non-secret CLI flags.

Configuration validation prints an effective non-secret summary. Status and
doctor report runtime health without printing resolved credentials.

## Validate before starting

```sh
token-shuffle config validate
```

From a repository checkout:

```sh
pnpm proxy:cli config validate
```

Validation checks syntax, unknown keys, environment-variable presence, loopback
binding, upstream URL policy, and incompatible options. It never prints resolved
secret values. `doctor` checks storage access and runtime connectivity.

Configuration changes require restart. A port collision is an error;
Token Shuffle does not silently choose a different port.

For runtime connectivity and storage checks:

```sh
token-shuffle doctor
```

From a repository checkout:

```sh
pnpm proxy:doctor
```

## Provider examples

An OpenAI-compatible provider changes only the upstream URL and environment
variable reference:

```jsonc
{
  "configVersion": 1,
  "upstream": {
    "type": "openai-compatible",
    "baseUrl": "https://provider.example/v1",
    "apiKey": {
      "fromEnv": "PROVIDER_API_KEY"
    }
  }
}
```

Provider-specific protocols such as Anthropic Messages are documented when
their adapters enter the supported compatibility matrix.
