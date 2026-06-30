# Configure Token Shuffle

> **Availability:** The current development proxy parses the initial
> single-upstream fields below. CLI validation, storage, and all multi-provider
> configuration remain planned for v0.1.

## Configuration location

The installed application uses the operating system's user configuration
directory:

| Platform | Planned path |
| --- | --- |
| macOS | `~/Library/Application Support/Token Shuffle/config.jsonc` |
| Linux | `${XDG_CONFIG_HOME:-~/.config}/token-shuffle/config.jsonc` |
| Windows | `%APPDATA%\Token Shuffle\config.jsonc` |

The planned installed CLI will use `token-shuffle config path` and `--config`.
During development, set `TOKEN_SHUFFLE_CONFIG=/path/to/config.jsonc`; otherwise
the proxy reads the platform path above.

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
    }
  },
  "storage": {
    "retainRawContent": false
  }
}
```

Replace `baseUrl` with the provider's official OpenAI-compatible endpoint. The
v0.1 proxy accepts one upstream and forwards the model ID supplied by the agent.
Multi-provider routing arrives later in the roadmap.

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

The development slice accepts `limits.requestBodyBytes`,
`limits.requestHeaderBytes`, `limits.concurrentInferenceRequests`,
`limits.upstreamConnectTimeoutMs`, `limits.responseHeaderTimeoutMs`, and
`limits.responseBodyTimeoutMs`. Oversized requests receive `413`;
excess concurrency receives `429`. Token Shuffle never converts a timeout into
an automatic inference retry.

### `mode`

- `observe` forwards requests without semantic transformation while recording
  approved structural metrics.
- Transform modes are unavailable until their roadmap release and require
  explicit policy configuration.

Observe mode is the default and the recommended starting point.

### `server`

`host` must default to `127.0.0.1`. Non-loopback binding is unsupported in early
releases and must never be used as a quick fix for local connection trouble.

If port `3210` is occupied, select another loopback port and update both agent
and dashboard URLs.

### `auth`

The local access token and upstream API key are different credentials:

- `TOKEN_SHUFFLE_ACCESS_TOKEN` authenticates agents to the local proxy.
- `UPSTREAM_API_KEY` authenticates Token Shuffle to the provider.

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

Initial defaults retain structural execution events for 30 days and redacted
errors for 14 days. Aggregate projections remain until deleted. Cache expiry is
configured separately.

Enable raw capture only for a bounded diagnostic or replay session after
reviewing the content involved. The web UI must make capture state conspicuous.

## Precedence

From lowest to highest:

1. built-in defaults;
2. the user configuration file;
3. documented environment overrides;
4. non-secret CLI flags.

The status and diagnostics commands show effective non-secret settings and their
sources.

## Validate before starting

The planned command:

```sh
token-shuffle config validate
```

Validation checks syntax, unknown keys, environment-variable presence, loopback
binding, upstream URL policy, storage path access, and incompatible options. It
never prints resolved secret values.

Configuration changes require restart in v0.1. A port collision is an error;
Token Shuffle does not silently choose a different port.

For runtime connectivity and storage checks, use the planned command:

```sh
token-shuffle doctor
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
