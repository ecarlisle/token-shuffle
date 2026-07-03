import { Agent, request } from "undici";

import { TokenShuffleError } from "../errors.js";
import type {
  InferenceProvider,
  UpstreamResponse,
} from "./inference-provider.js";

const RESPONSE_HEADERS = new Set([
  "content-type",
  "request-id",
  "retry-after",
  "x-request-id",
]);

export class AnthropicProvider implements InferenceProvider {
  public readonly protocol = "anthropic-messages" as const;
  public readonly providerKind = "anthropic" as const;
  readonly #dispatcher: Agent;

  public constructor(
    private readonly options: {
      readonly baseUrl: URL;
      readonly apiKey: string;
      readonly anthropicVersion: string;
      readonly connectTimeoutMs: number;
      readonly responseHeaderTimeoutMs: number;
      readonly responseBodyTimeoutMs: number;
    },
  ) {
    this.#dispatcher = new Agent({
      connect: { timeout: options.connectTimeoutMs },
    });
  }

  public prepareRequest(rawBody: Buffer): Buffer {
    return rawBody;
  }

  public async execute(
    rawBody: Buffer,
    signal: AbortSignal,
  ): Promise<UpstreamResponse> {
    const url = new URL("messages", trailingSlash(this.options.baseUrl));
    try {
      const response = await request(url, {
        method: "POST",
        dispatcher: this.#dispatcher,
        signal,
        headersTimeout: this.options.responseHeaderTimeoutMs,
        bodyTimeout: this.options.responseBodyTimeoutMs,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-api-key": this.options.apiKey,
          "anthropic-version": this.options.anthropicVersion,
        },
        body: rawBody,
      });
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(response.headers)) {
        const normalized = name.toLowerCase();
        if (
          typeof value === "string" &&
          (RESPONSE_HEADERS.has(normalized) ||
            normalized.startsWith("anthropic-ratelimit-"))
        ) {
          headers[normalized] = value;
        }
      }
      return { statusCode: response.statusCode, body: response.body, headers };
    } catch (error) {
      if (signal.aborted) throw error;
      throw new TokenShuffleError(
        502,
        "upstream_unavailable",
        "The configured Anthropic upstream could not complete the request.",
        { cause: error },
      );
    }
  }

  public async close(): Promise<void> {
    await this.#dispatcher.close();
  }
}

function trailingSlash(url: URL): URL {
  const value = new URL(url);
  if (!value.pathname.endsWith("/")) value.pathname += "/";
  return value;
}
