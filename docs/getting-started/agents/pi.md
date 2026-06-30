# Configure Pi Coding Agent

> **Token Shuffle availability:** Pi configuration is intended for the completed
> v0.1 proxy. The current development slice rejects streaming and is not yet
> claimed compatible with Pi.

Pi supports custom providers and proxies through
`~/.pi/agent/models.json`. Token Shuffle's first protocol uses Pi's
`openai-completions` API type.

## 1. Export the local proxy token

Pi must inherit the same local token used by Token Shuffle:

```sh
export TOKEN_SHUFFLE_ACCESS_TOKEN="the-local-token-you-generated"
```

Pi resolves `$TOKEN_SHUFFLE_ACCESS_TOKEN` from the environment at request time.
This is not the upstream provider key.

## 2. Add the provider and model

Create or update `~/.pi/agent/models.json`:

```json
{
  "providers": {
    "token-shuffle": {
      "baseUrl": "http://127.0.0.1:3210/v1",
      "api": "openai-completions",
      "apiKey": "$TOKEN_SHUFFLE_ACCESS_TOKEN",
      "authHeader": true,
      "models": [
        {
          "id": "provider-model-id",
          "name": "Provider Model via Token Shuffle",
          "contextWindow": 128000,
          "maxTokens": 16384
        }
      ]
    }
  }
}
```

Replace `provider-model-id`, `contextWindow`, and `maxTokens` with values
appropriate for the upstream model. Token Shuffle v0.1 forwards the model ID
unchanged.

If Token Shuffle uses a non-default port, update `baseUrl`. Keep the `/v1`
suffix.

## 3. Select and test the model

Start Token Shuffle, then start Pi and run:

```text
/model
```

Select the `token-shuffle` provider and configured model. Pi reloads
`models.json` when `/model` is opened, so configuration edits do not normally
require restarting Pi.

Send a read-only test prompt. In v0.2, confirm the request in the Token Shuffle
dashboard.

## Optional default selection

To make the proxied model Pi's default, merge these keys into
`~/.pi/agent/settings.json`:

```json
{
  "defaultProvider": "token-shuffle",
  "defaultModel": "provider-model-id"
}
```

## Compatibility notes

Pi supports compatibility overrides for partially compatible servers. Do not
add them preemptively. Token Shuffle's OpenAI-compatible ingress should accept
standard developer roles, reasoning fields, streaming usage, and tool results
according to its published compatibility matrix.

If a compatibility failure is confirmed, record it as a Token Shuffle protocol
bug or documented limitation before setting Pi overrides. This keeps client-side
workarounds visible.

Source: [Pi custom models and providers](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md)
and [Pi settings](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/settings.md).
