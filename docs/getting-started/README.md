# Getting started

> **Availability:** The proxy journey is implemented in v0.1.0. OpenCode with
> OpenCode Zen is verified; Pi and other upstream combinations remain
> provisional. The web UI begins in v0.2.

Token Shuffle runs on your workstation between a coding agent and an inference
provider:

```text
OpenCode or Pi
      |
      | http://127.0.0.1:3210/v1
      v
Token Shuffle
      |
      | authenticated provider request
      v
Inference provider
```

Your agent receives a local Token Shuffle access token. The inference provider's
real API key is configured only in Token Shuffle and is never copied into the
agent configuration.

## Before you begin

For v0.1 you will need:

- Token Shuffle installed, or the repository checked out for development;
- an API key for one supported OpenAI-compatible upstream provider;
- an upstream model identifier;
- OpenCode or Pi Coding Agent;
- an unused loopback port, defaulting to `3210`.

## 1. Create local credentials

Create two environment variables in the shell or service environment that will
start Token Shuffle:

```sh
export TOKEN_SHUFFLE_ACCESS_TOKEN="generate-a-long-random-value"
export UPSTREAM_API_KEY="your-provider-api-key"
```

`TOKEN_SHUFFLE_ACCESS_TOKEN` protects the local proxy from other processes or
web pages that try to call loopback services. `UPSTREAM_API_KEY` is sent only to
the configured inference provider.

Use a password manager or cryptographically secure random generator for the
local token. Do not commit either value or place the upstream key in an agent
configuration.

## 2. Configure Token Shuffle

Create the application configuration described in
[Configure Token Shuffle](configuration.md). The initial configuration selects:

- loopback host and port;
- observe-only mode;
- local access-token source;
- one OpenAI-compatible upstream;
- privacy-preserving storage defaults.

## 3. Start Token Shuffle

The installed CLI is:

```sh
token-shuffle start
token-shuffle status
```

Use foreground mode for troubleshooting:

```sh
token-shuffle start --foreground
```

The desktop release starts the same proxy sidecar from its tray application.
Closing the dashboard window does not stop the proxy; choosing **Quit Token
Shuffle** does.

Verify the local process:

```sh
curl \
  -H "Authorization: Bearer $TOKEN_SHUFFLE_ACCESS_TOKEN" \
  http://127.0.0.1:3210/_token-shuffle/status
```

The response reports readiness, mode, version, streaming support, and degraded
persistence state without exposing credentials. Use `token-shuffle doctor` for
SQLite and upstream diagnostics.

### Repository development

Node 24.15+ is required. Copy and edit the example configuration, then run:

```sh
cp config.example.jsonc config.local.jsonc
export TOKEN_SHUFFLE_CONFIG="$PWD/config.local.jsonc"
export TOKEN_SHUFFLE_ACCESS_TOKEN="generate-a-long-random-value"
export UPSTREAM_API_KEY="your-provider-api-key"
pnpm install
pnpm dev
```

`config.local.jsonc` is ignored by this repository. The file contains no literal
secrets, but it may contain workstation-specific provider details.

Check status:

```sh
curl \
  -H "Authorization: Bearer $TOKEN_SHUFFLE_ACCESS_TOKEN" \
  http://127.0.0.1:3210/_token-shuffle/status
```

Exercise buffered forwarding:

```sh
curl \
  -H "Authorization: Bearer $TOKEN_SHUFFLE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"provider-model-id","messages":[{"role":"user","content":"Reply with OK."}]}' \
  http://127.0.0.1:3210/v1/chat/completions
```

The proxy preserves valid request bytes, replaces local authorization with
upstream authorization, streams SSE with backpressure, records privacy-safe
structural metrics, and performs no automatic retry.

## 4. Configure your coding agent

Choose one:

- [OpenCode configuration](agents/opencode.md)
- [Pi Coding Agent configuration](agents/pi.md)

Use the same `TOKEN_SHUFFLE_ACCESS_TOKEN` value in the agent environment. The
model ID sent by the agent must be accepted by the configured upstream. During
v0.1, Token Shuffle forwards that model ID unchanged.

## 5. Make a first request

Start the agent, select the Token Shuffle provider/model, and make a harmless
request such as:

```text
Reply with the current repository name. Do not modify files.
```

Confirm that:

1. the agent receives a streamed response;
2. the status endpoint reports no dropped persistence events;
3. the upstream provider and model are correct;
4. mode is `observe`, so the request was not semantically transformed.

## 6. Open the dashboard

For v0.2:

```sh
token-shuffle open
```

Or open `http://127.0.0.1:3210/` from the same workstation. See
[Using the web UI](web-ui.md).

## Stop the application

```sh
token-shuffle stop
```

Stopping Token Shuffle while an agent request is active aborts that request; it
must not silently retry or duplicate the inference.

## Common checks

| Symptom | Check |
| --- | --- |
| Connection refused | Token Shuffle is running and the agent uses port `3210` |
| Unauthorized | Agent and proxy environments use the same local access token |
| Provider rejected key | `UPSTREAM_API_KEY` belongs to the configured upstream |
| Model not found | Agent model ID exactly matches an upstream model ID |
| No dashboard | The evidence dashboard begins in v0.2 |
| No readable replay | Raw-content retention is off by default |

Never work around a connection problem by binding Token Shuffle to all network
interfaces or disabling authentication.
