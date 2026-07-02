# Getting started

> **Availability:** The proxy, evidence dashboard, and opt-in deterministic
> reduction, compaction, and retrieval policies are implemented in v0.5.0.
> OpenCode and Pi with OpenCode Zen are verified; other upstream combinations
> remain provisional.

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

Create three environment variables in the shell or service environment that will
start Token Shuffle:

```sh
export TOKEN_SHUFFLE_ACCESS_TOKEN="generate-a-long-random-value"
export TOKEN_SHUFFLE_FINGERPRINT_KEY="generate-an-independent-random-value"
export UPSTREAM_API_KEY="your-provider-api-key"
```

`TOKEN_SHUFFLE_ACCESS_TOKEN` protects the local proxy from other processes or
web pages that try to call loopback services. `TOKEN_SHUFFLE_FINGERPRINT_KEY`
scopes local content identities and is never persisted or sent upstream.
`UPSTREAM_API_KEY` is sent only to the configured inference provider.

Use a password manager or cryptographically secure random generator for the
local secrets. Do not commit any value or place the upstream key in an agent
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

### Packaged or linked CLI

Token Shuffle is not currently published as a global npm package. The binary
name below is available only from a packaged distribution or when the proxy
package has been explicitly linked:

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

### Repository checkout

Node 24.15+ is required. Copy and edit the example configuration, export the
two referenced secrets, build, and use the repository scripts:

```sh
cp config.example.jsonc config.local.jsonc
export TOKEN_SHUFFLE_ACCESS_TOKEN="generate-a-long-random-value"
export TOKEN_SHUFFLE_FINGERPRINT_KEY="generate-an-independent-random-value"
export UPSTREAM_API_KEY="your-provider-api-key"
pnpm install
pnpm build
pnpm proxy:start
pnpm proxy:status
pnpm proxy:open
pnpm proxy:doctor
```

`config.local.jsonc` is ignored by this repository. The file contains no literal
secrets, but it may contain workstation-specific provider details.

For foreground proxy and dashboard development with watch mode, use `pnpm dev`.
That is distinct from the lifecycle-managed CLI process above.

Check status without the CLI:

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

### Optional v0.5 retrieval test

After initial observe-mode testing, set `mode` to `optimize`, enable
`policies.retrieval`, and configure an explicit session header in the agent
guide. A compacted long conversation or a tool/file result of at least 512
characters creates an artifact. Ask the model or send:

```text
token_shuffle_retrieve("an exact artifact ID, file path, symbol, or distinctive term")
```

If a model emits this marker, continue the conversation once so the client
replays the assistant turn. Token Shuffle retrieves on that next request; it
does not launch an inference retry itself. Confirm the dashboard shows artifact
retention and a `retrieval.completed` event. A miss is safe and leaves the
request otherwise unchanged.

## 6. Open the dashboard

Packaged or linked CLI:

```sh
token-shuffle open
```

Repository checkout:

```sh
pnpm proxy:open
```

Or open `http://127.0.0.1:3210/` from the same workstation. See
[Using the web UI](web-ui.md).

## Stop the application

Packaged or linked CLI:

```sh
token-shuffle stop
```

Repository checkout:

```sh
pnpm proxy:stop
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
| No dashboard | Run `pnpm proxy:open` in a checkout or `token-shuffle open` from an installed/linked CLI; do not reuse an expired bootstrap URL |
| No readable replay | Raw-content retention is off by default |

Never work around a connection problem by binding Token Shuffle to all network
interfaces or disabling authentication.

## See also

- [Configuration reference](configuration.md)
- [OpenCode setup](agents/opencode.md)
- [Pi setup](agents/pi.md)
- [Dashboard guide](web-ui.md)
- [Capability status](../capabilities.md)
