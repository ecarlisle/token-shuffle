import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { once } from "node:events";

import { ExecutionCoordinator } from "./application/execution-coordinator.js";
import { hasValidBearerToken } from "./auth/bearer-auth.js";
import type { RuntimeConfig } from "./config/schema.js";
import { errorEnvelope, TokenShuffleError } from "./errors.js";
import {
  NoopEventSink,
  ResilientEventSink,
  type EventSink,
} from "./observation/events.js";
import {
  parseRawJsonBody,
  isStreamingRequest,
  type RawJsonBody,
  validateChatCompletionsRequest,
} from "./protocol/openai/chat-completions.js";
import { OpenAiCompatibleProvider } from "./providers/openai-compatible.js";

export function buildApp(
  config: RuntimeConfig,
  options: { readonly eventSink?: EventSink; readonly logging?: boolean } = {},
): FastifyInstance {
  const app = Fastify({
    bodyLimit: config.limits.requestBodyBytes,
    logger:
      options.logging === true
        ? {
            level: "info",
            redact: {
              paths: ["req.headers.authorization"],
              censor: "[REDACTED]",
            },
          }
        : false,
    http: {
      maxHeaderSize: config.limits.requestHeaderBytes,
    },
  });
  const provider = new OpenAiCompatibleProvider({
    baseUrl: config.upstream.baseUrl,
    apiKey: config.upstream.apiKey,
    connectTimeoutMs: config.limits.upstreamConnectTimeoutMs,
    responseHeaderTimeoutMs: config.limits.responseHeaderTimeoutMs,
    responseBodyTimeoutMs: config.limits.responseBodyTimeoutMs,
  });
  const eventSink = new ResilientEventSink(options.eventSink ?? new NoopEventSink());
  const coordinator = new ExecutionCoordinator(
    provider,
    config.limits.concurrentInferenceRequests,
    eventSink,
  );
  const shutdownController = new AbortController();

  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_request, body, done) => {
      try {
        if (!Buffer.isBuffer(body)) {
          throw new TokenShuffleError(400, "invalid_request", "Request body must be JSON.");
        }
        done(null, parseRawJsonBody(body));
      } catch (error) {
        done(error as Error);
      }
    },
  );

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof TokenShuffleError) {
      sendLocalError(reply, error);
      return;
    }

    const fastifyError =
      typeof error === "object" && error !== null
        ? (error as { readonly statusCode?: number; readonly code?: string })
        : undefined;
    if (
      fastifyError?.statusCode === 413 ||
      fastifyError?.code === "FST_ERR_CTP_BODY_TOO_LARGE"
    ) {
      sendLocalError(
        reply,
        new TokenShuffleError(413, "invalid_request", "Request body exceeds the configured limit."),
      );
      return;
    }

    sendLocalError(
      reply,
      new TokenShuffleError(500, "invalid_request", "Token Shuffle could not process the request."),
    );
  });

  const authenticate = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!hasValidBearerToken(request.headers.authorization, config.auth.accessToken)) {
      sendLocalError(
        reply,
        new TokenShuffleError(
          401,
          "invalid_authorization",
          "A valid Token Shuffle bearer token is required.",
        ),
      );
      return;
    }
    if (request.headers.origin !== undefined) {
      sendLocalError(
        reply,
        new TokenShuffleError(
          403,
          "invalid_request",
          "Browser-origin inference requests are not accepted.",
        ),
      );
    }
  };

  app.get(
    "/_token-shuffle/status",
    { preHandler: authenticate },
    async () => ({
      mode: "observe",
      name: "token-shuffle",
      phase: "v0.1-release-candidate",
      persistence: eventSink.health,
      ready: true,
      streaming: true,
      version: "0.1.0-rc.1",
    }),
  );

  app.post<{ Body: RawJsonBody }>(
    "/v1/chat/completions",
    { preHandler: authenticate },
    async (request, reply) => {
      validateChatCompletionsRequest(request.body);

      const abortController = new AbortController();
      const abortUpstream = (): void => abortController.abort();
      request.raw.once("aborted", abortUpstream);
      reply.raw.once("close", () => {
        if (!reply.raw.writableEnded) {
          abortUpstream();
        }
      });

      const response = await coordinator.execute(
        request.body,
        AbortSignal.any([abortController.signal, shutdownController.signal]),
        firstHeaderValue(request.headers["x-token-shuffle-session-id"]),
      );
      if (response === undefined) {
        throw new TokenShuffleError(
          429,
          "overloaded",
          "The concurrent inference request limit has been reached.",
        );
      }

      try {
        if (isStreamingRequest(request.body)) {
          reply.hijack();
          reply.raw.writeHead(response.statusCode, {
            ...response.headers,
            "x-token-shuffle-request-id": response.requestId,
          });
          const eventLimit = new SseEventLimit(config.limits.sseEventBytes);
          let responseBytes = 0;
          try {
            for await (const part of response.body) {
              const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
              response.firstByte();
              responseBytes += chunk.byteLength;
              eventLimit.inspect(chunk);
              if (!reply.raw.write(chunk)) {
                await once(reply.raw, "drain");
              }
            }
            reply.raw.end();
            response.complete(responseBytes);
          } catch (error) {
            abortController.abort();
            response.fail(error);
            reply.raw.destroy(error as Error);
          }
          return;
        }

        const chunks: Buffer[] = [];
        let responseBytes = 0;
        try {
          for await (const part of response.body) {
            const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
            response.firstByte();
            chunks.push(chunk);
            responseBytes += chunk.byteLength;
          }
        } catch (error) {
          response.fail(error);
          throw error instanceof TokenShuffleError
            ? error
            : new TokenShuffleError(
                502,
                "upstream_unavailable",
                "The configured upstream response ended unexpectedly.",
                { cause: error },
              );
        }
        const body = Buffer.concat(chunks, responseBytes);
        reply.code(response.statusCode);
        reply.header("x-token-shuffle-request-id", response.requestId);
        for (const [name, value] of Object.entries(response.headers)) {
          reply.header(name, value);
        }
        response.complete(responseBytes, readProviderUsage(body));
        return reply.send(body);
      } finally {
        response.release();
      }
    },
  );

  app.get(
    "/v1/models",
    { preHandler: authenticate },
    async (request, reply) => {
      const abortController = new AbortController();
      request.raw.once("aborted", () => abortController.abort());
      const response = await provider.models(
        AbortSignal.any([abortController.signal, shutdownController.signal]),
      );
      const body = Buffer.from(await response.body.arrayBuffer());
      reply.code(response.statusCode);
      for (const [name, value] of Object.entries(response.headers)) {
        reply.header(name, value);
      }
      return reply.send(body);
    },
  );

  app.addHook("preClose", async () => {
    shutdownController.abort();
    await coordinator.close();
  });

  app.addHook("onClose", async () => {
    await provider.close();
    await options.eventSink?.close?.();
  });

  return app;
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function readProviderUsage(body: Buffer): {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
} | undefined {
  try {
    const parsed = JSON.parse(body.toString("utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null || !("usage" in parsed)) {
      return undefined;
    }
    const usage = parsed.usage;
    if (typeof usage !== "object" || usage === null) {
      return undefined;
    }
    const inputTokens =
      "prompt_tokens" in usage && Number.isSafeInteger(usage.prompt_tokens)
        ? (usage.prompt_tokens as number)
        : undefined;
    const outputTokens =
      "completion_tokens" in usage && Number.isSafeInteger(usage.completion_tokens)
        ? (usage.completion_tokens as number)
        : undefined;
    const cacheReadInputTokens = readCachedTokens(usage);
    return inputTokens === undefined &&
      outputTokens === undefined &&
      cacheReadInputTokens === undefined
      ? undefined
      : { inputTokens, outputTokens, cacheReadInputTokens };
  } catch {
    return undefined;
  }
}

function readCachedTokens(usage: object): number | undefined {
  if (!("prompt_tokens_details" in usage)) return undefined;
  const details = usage.prompt_tokens_details;
  if (
    typeof details === "object" &&
    details !== null &&
    "cached_tokens" in details &&
    Number.isSafeInteger(details.cached_tokens)
  ) {
    return details.cached_tokens as number;
  }
  return undefined;
}

function sendLocalError(reply: FastifyReply, error: TokenShuffleError): void {
  reply
    .header("x-token-shuffle-error", "true")
    .code(error.statusCode)
    .send(errorEnvelope(error));
}

class SseEventLimit {
  #eventBytes = 0;
  #lineBytes = 0;

  public constructor(private readonly maximumBytes: number) {}

  public inspect(chunk: Buffer): void {
    for (const byte of chunk) {
      this.#eventBytes += 1;
      if (this.#eventBytes > this.maximumBytes) {
        throw new TokenShuffleError(
          502,
          "upstream_unavailable",
          "An upstream SSE event exceeded the configured limit.",
        );
      }
      if (byte === 10) {
        if (this.#lineBytes === 0) {
          this.#eventBytes = 0;
        }
        this.#lineBytes = 0;
      } else if (byte !== 13) {
        this.#lineBytes += 1;
      }
    }
  }
}
