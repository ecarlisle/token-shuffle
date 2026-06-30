# Configure OpenCode

> **Token Shuffle availability:** v0.1.0 is verified with OpenCode 1.17.11,
> OpenCode Zen, and `deepseek-v4-flash-free`. Other providers and models remain
> separate compatibility claims.

OpenCode supports custom OpenAI-compatible providers through
`@ai-sdk/openai-compatible`. Its global configuration is
`~/.config/opencode/opencode.json` or `.jsonc`; a project-level
`opencode.json` can override it.

## 1. Export the local proxy token

OpenCode must inherit the same local token used by Token Shuffle:

```sh
export TOKEN_SHUFFLE_ACCESS_TOKEN="the-local-token-you-generated"
```

This is not the inference provider's API key.

## 2. Add the provider

Create or update `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "token-shuffle": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Token Shuffle",
      "options": {
        "baseURL": "http://127.0.0.1:3210/v1",
        "apiKey": "{env:TOKEN_SHUFFLE_ACCESS_TOKEN}"
      },
      "models": {
        "provider-model-id": {
          "name": "Provider Model via Token Shuffle"
        }
      }
    }
  },
  "model": "token-shuffle/provider-model-id"
}
```

Replace both occurrences of `provider-model-id` with the exact model ID accepted
by the upstream configured in Token Shuffle.

If Token Shuffle uses a non-default port, update `baseURL`. Keep the `/v1`
suffix.

## 3. Select and test the model

Start Token Shuffle, then start OpenCode. Run:

```text
/models
```

Select **Token Shuffle** and the configured model. Send a read-only test prompt.
In v0.2, confirm the request in the Token Shuffle dashboard.

## Project-specific configuration

Place the same provider block in `opencode.jsonc` at a project root to scope it
to that repository. OpenCode merges configuration sources, and project settings
override global settings for conflicts.

Do not commit a literal access token. Keep the environment substitution exactly
as shown.

## Notes

- The custom provider package targets OpenAI Chat Completions, which is Token
  Shuffle's first ingress protocol.
- OpenCode may have its own context compaction or pruning features. Record their
  settings during Token Shuffle evaluations so savings are not attributed twice.
- Provider timeouts can be added under `options`, but begin with defaults and
  diagnose the proxy or upstream before increasing them.

Source: [OpenCode custom providers](https://opencode.ai/docs/providers) and
[OpenCode configuration](https://opencode.ai/docs/config/).
