import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { ConfigError, parseConfig } from "./load-config.js";

const validConfig = `{
  // Secrets are references, never literals.
  "configVersion": 1,
  "mode": "observe",
  "server": { "host": "127.0.0.1", "port": 3210 },
  "auth": { "accessToken": { "fromEnv": "LOCAL_TOKEN" } },
  "upstream": {
    "type": "openai-compatible",
    "baseUrl": "https://api.example.test/v1/",
    "apiKey": { "fromEnv": "PROVIDER_KEY" },
  },
}`;

describe("parseConfig", () => {
  it("keeps the checked-in example synchronized with the parser", async () => {
    const source = await readFile(
      new URL("../../../../config.example.jsonc", import.meta.url),
      "utf8",
    );

    expect(
      parseConfig(source, {
        TOKEN_SHUFFLE_ACCESS_TOKEN: "local-secret",
        UPSTREAM_API_KEY: "provider-secret",
      }).configVersion,
    ).toBe(1);
  });

  it("parses JSONC, resolves secret references, and applies limits", () => {
    const config = parseConfig(validConfig, {
      LOCAL_TOKEN: "local-secret",
      PROVIDER_KEY: "provider-secret",
    });

    expect(config.auth.accessToken).toBe("local-secret");
    expect(config.upstream.apiKey).toBe("provider-secret");
    expect(config.upstream.baseUrl.href).toBe("https://api.example.test/v1/");
    expect(config.limits.requestBodyBytes).toBe(16 * 1024 * 1024);
    expect(config.storage.retainRawContent).toBe(false);
  });

  it("rejects unknown keys and missing environment variables", () => {
    expect(() =>
      parseConfig(validConfig.replace('"mode": "observe",', '"mode": "observe", "typo": true,'), {
        LOCAL_TOKEN: "local-secret",
        PROVIDER_KEY: "provider-secret",
      }),
    ).toThrow(ConfigError);
    expect(() => parseConfig(validConfig, {})).toThrow(/LOCAL_TOKEN/);
  });

  it("allows loopback HTTP but rejects unsafe upstreams and bindings", () => {
    const environment = {
      LOCAL_TOKEN: "local-secret",
      PROVIDER_KEY: "provider-secret",
    };
    const loopback = validConfig.replace(
      "https://api.example.test/v1/",
      "http://127.0.0.1:11434/v1/",
    );
    const remoteHttp = validConfig.replace(
      "https://api.example.test/v1/",
      "http://api.example.test/v1/",
    );
    const wildcard = validConfig.replace('"host": "127.0.0.1"', '"host": "0.0.0.0"');

    expect(parseConfig(loopback, environment).upstream.baseUrl.protocol).toBe("http:");
    expect(() => parseConfig(remoteHttp, environment)).toThrow(/require HTTPS/);
    expect(() => parseConfig(wildcard, environment)).toThrow(ConfigError);
  });
});
