import { Agent, request, type Dispatcher } from "undici";

import { TokenShuffleError } from "../errors.js";

const RESPONSE_HEADERS = new Set([
  "content-type",
  "openai-processing-ms",
  "retry-after",
  "x-request-id",
]);

export interface UpstreamResponse {
  readonly statusCode: number;
  readonly body: Dispatcher.ResponseData["body"];
  readonly headers: Readonly<Record<string, string>>;
}

export class OpenAiCompatibleProvider {
  readonly #dispatcher: Agent;

  public constructor(
    private readonly options: {
      readonly baseUrl: URL;
      readonly apiKey: string;
      readonly connectTimeoutMs: number;
      readonly responseHeaderTimeoutMs: number;
      readonly responseBodyTimeoutMs: number;
    },
  ) {
    this.#dispatcher = new Agent({
      connect: { timeout: options.connectTimeoutMs },
    });
  }

  public async chatCompletions(
    rawBody: Buffer,
    signal: AbortSignal,
  ): Promise<UpstreamResponse> {
    return this.#request("chat/completions", signal, rawBody);
  }

  public async models(signal: AbortSignal): Promise<UpstreamResponse> {
    return this.#request("models", signal);
  }

  async #request(
    path: string,
    signal: AbortSignal,
    body?: Buffer,
  ): Promise<UpstreamResponse> {
    const url = new URL(path, ensureTrailingSlash(this.options.baseUrl));

    try {
      const response = await request(url, {
        method: body === undefined ? "GET" : "POST",
        dispatcher: this.#dispatcher,
        signal,
        headersTimeout: this.options.responseHeaderTimeoutMs,
        bodyTimeout: this.options.responseBodyTimeoutMs,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.options.apiKey}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body,
      });
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(response.headers)) {
        const normalizedName = name.toLowerCase();
        if (
          typeof value === "string" &&
          (RESPONSE_HEADERS.has(normalizedName) ||
            normalizedName.startsWith("x-ratelimit-"))
        ) {
          headers[normalizedName] = value;
        }
      }
      return { statusCode: response.statusCode, body: response.body, headers };
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
      throw new TokenShuffleError(
        502,
        "upstream_unavailable",
        "The configured upstream could not complete the request.",
        { cause: error },
      );
    }
  }

  public async close(): Promise<void> {
    await this.#dispatcher.close();
  }
}

function ensureTrailingSlash(url: URL): URL {
  const normalized = new URL(url);
  if (!normalized.pathname.endsWith("/")) {
    normalized.pathname += "/";
  }
  return normalized;
}
