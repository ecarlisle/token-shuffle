import { Agent, request } from "undici";

import { TokenShuffleError } from "../errors.js";
import type {
  InferenceProvider,
  UpstreamResponse,
} from "./inference-provider.js";

const RESPONSE_HEADERS = new Set([
  "content-type",
  "openai-processing-ms",
  "retry-after",
  "x-request-id",
]);

export class OpenAiCompatibleProvider implements InferenceProvider {
  public readonly protocol = "openai-chat-completions" as const;
  public readonly providerKind = "openai-compatible" as const;
  readonly #dispatcher: Agent;

  public constructor(
    private readonly options: {
      readonly baseUrl: URL;
      readonly apiKey: string;
      readonly connectTimeoutMs: number;
      readonly responseHeaderTimeoutMs: number;
      readonly responseBodyTimeoutMs: number;
      readonly developerRole: "preserve" | "system";
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
    return this.#request(
      "chat/completions",
      signal,
      this.prepareChatCompletions(rawBody),
    );
  }

  public async execute(
    rawBody: Buffer,
    signal: AbortSignal,
  ): Promise<UpstreamResponse> {
    return this.chatCompletions(rawBody, signal);
  }

  public prepareRequest(rawBody: Buffer): Buffer {
    return this.prepareChatCompletions(rawBody);
  }

  public prepareChatCompletions(rawBody: Buffer): Buffer {
    return normalizeDeveloperRole(rawBody, this.options.developerRole);
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

function normalizeDeveloperRole(
  rawBody: Buffer,
  policy: "preserve" | "system",
): Buffer {
  if (policy === "preserve") return rawBody;

  const request = JSON.parse(rawBody.toString("utf8")) as unknown;
  if (
    typeof request !== "object" ||
    request === null ||
    !("messages" in request) ||
    !Array.isArray(request.messages)
  ) {
    return rawBody;
  }

  let changed = false;
  const messages = request.messages.map((message) => {
    if (
      typeof message !== "object" ||
      message === null ||
      !("role" in message) ||
      message.role !== "developer"
    ) {
      return message;
    }
    changed = true;
    return { ...message, role: "system" };
  });

  return changed
    ? Buffer.from(JSON.stringify({ ...request, messages }))
    : rawBody;
}

function ensureTrailingSlash(url: URL): URL {
  const normalized = new URL(url);
  if (!normalized.pathname.endsWith("/")) {
    normalized.pathname += "/";
  }
  return normalized;
}
