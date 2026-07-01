import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { Value } from "@sinclair/typebox/value";
import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";

import {
  TokenShuffleConfigSchema,
  type RuntimeConfig,
  type TokenShuffleConfigFile,
} from "./schema.js";

const DEFAULT_LIMITS: RuntimeConfig["limits"] = {
  requestBodyBytes: 16 * 1024 * 1024,
  requestHeaderBytes: 16 * 1024,
  concurrentInferenceRequests: 16,
  upstreamConnectTimeoutMs: 10_000,
  responseHeaderTimeoutMs: 5 * 60_000,
  responseBodyTimeoutMs: 2 * 60_000,
  sseEventBytes: 8 * 1024 * 1024,
};

export class ConfigError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ConfigError";
  }
}

function resolveSecret(
  reference: { readonly fromEnv: string },
  environment: NodeJS.ProcessEnv,
): string {
  const value = environment[reference.fromEnv];
  if (value === undefined || value.length === 0) {
    throw new ConfigError(
      `Required environment variable ${reference.fromEnv} is missing or empty.`,
    );
  }
  return value;
}

function validateUpstream(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch (error) {
    throw new ConfigError("upstream.baseUrl must be a valid URL.", { cause: error });
  }

  if (url.username !== "" || url.password !== "") {
    throw new ConfigError("upstream.baseUrl must not contain credentials.");
  }

  const loopbackHosts = new Set(["127.0.0.1", "::1", "localhost"]);
  const safeRemote = url.protocol === "https:";
  const safeLoopback = url.protocol === "http:" && loopbackHosts.has(url.hostname);
  if (!safeRemote && !safeLoopback) {
    throw new ConfigError(
      "Remote upstreams require HTTPS; HTTP is allowed only for loopback upstreams.",
    );
  }

  return url;
}

export function parseConfig(
  source: string,
  environment: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const parseErrors: ParseError[] = [];
  const value: unknown = parse(source, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (parseErrors.length > 0) {
    const first = parseErrors[0];
    throw new ConfigError(
      `Invalid JSONC configuration: ${
        first === undefined ? "unknown parse error" : printParseErrorCode(first.error)
      }.`,
    );
  }

  if (!Value.Check(TokenShuffleConfigSchema, value)) {
    const first = Value.Errors(TokenShuffleConfigSchema, value).First();
    const location = first?.path === "" ? "configuration" : first?.path;
    throw new ConfigError(`Invalid configuration at ${location}: ${first?.message}.`);
  }

  const config = value as TokenShuffleConfigFile;
  return {
    configVersion: 1,
    mode: config.mode,
    server: config.server,
    auth: {
      accessToken: resolveSecret(config.auth.accessToken, environment),
    },
    upstream: {
      type: "openai-compatible",
      baseUrl: validateUpstream(config.upstream.baseUrl),
      apiKey: resolveSecret(config.upstream.apiKey, environment),
      compatibility: {
        developerRole: config.upstream.compatibility?.developerRole ?? "preserve",
      },
    },
    storage: {
      retainRawContent: false,
      path: config.storage?.path ?? join(dirname(defaultConfigPath()), "events.sqlite"),
      structuralRetentionDays: config.storage?.structuralRetentionDays ?? 30,
      errorRetentionDays: config.storage?.errorRetentionDays ?? 14,
    },
    policies: {
      killSwitch: config.policies?.killSwitch ?? false,
      toolOutput: {
        enabled: config.policies?.toolOutput?.enabled ?? false,
        collapseRepeatedLinesAfter:
          config.policies?.toolOutput?.collapseRepeatedLinesAfter ?? 3,
        maximumInputCharacters:
          config.policies?.toolOutput?.maximumInputCharacters ?? 64 * 1024,
      },
      exactRedundancy: {
        enabled: config.policies?.exactRedundancy?.enabled ?? false,
      },
      conversationCompaction: {
        enabled: config.policies?.conversationCompaction?.enabled ?? false,
        minimumMessages:
          config.policies?.conversationCompaction?.minimumMessages ?? 12,
        activeWindowMessages:
          config.policies?.conversationCompaction?.activeWindowMessages ?? 6,
        maximumSourceCharacters:
          config.policies?.conversationCompaction?.maximumSourceCharacters ??
          256_000,
      },
    },
    limits: {
      ...DEFAULT_LIMITS,
      ...config.limits,
    },
  };
}

export function defaultConfigPath(
  platform: NodeJS.Platform = process.platform,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  if (platform === "win32") {
    const appData = environment.APPDATA;
    if (appData === undefined) {
      throw new ConfigError("APPDATA is required to locate the default configuration.");
    }
    return join(appData, "Token Shuffle", "config.jsonc");
  }

  if (platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Token Shuffle", "config.jsonc");
  }

  const configHome = environment.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(configHome, "token-shuffle", "config.jsonc");
}

export async function loadConfig(
  path = process.env.TOKEN_SHUFFLE_CONFIG ?? defaultConfigPath(),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<RuntimeConfig> {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    throw new ConfigError(`Unable to read configuration at ${path}.`, { cause: error });
  }
  const config = parseConfig(source, environment);
  return {
    ...config,
    storage: {
      ...config.storage,
      path: isAbsolute(config.storage.path)
        ? config.storage.path
        : resolve(dirname(path), config.storage.path),
    },
  };
}
