import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

import { ExecutionCoordinator } from "./application/execution-coordinator.js";
import { hasValidBearerToken } from "./auth/bearer-auth.js";
import type { RuntimeConfig } from "./config/schema.js";
import { errorEnvelope, TokenShuffleError } from "./errors.js";
import {
  parseRawJsonBody,
  type RawJsonBody,
  validateChatCompletionsRequest,
} from "./protocol/openai/chat-completions.js";
import { OpenAiCompatibleProvider } from "./providers/openai-compatible.js";

export function buildApp(config: RuntimeConfig): FastifyInstance {
  const app = Fastify({
    bodyLimit: config.limits.requestBodyBytes,
    logger: false,
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
  const coordinator = new ExecutionCoordinator(
    provider,
    config.limits.concurrentInferenceRequests,
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
    }
  };

  app.get(
    "/_token-shuffle/status",
    { preHandler: authenticate },
    async () => ({
      mode: "observe",
      name: "token-shuffle",
      phase: "v0.1-development",
      ready: true,
      streaming: false,
      version: "0.0.0",
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
      );
      if (response === undefined) {
        throw new TokenShuffleError(
          429,
          "overloaded",
          "The concurrent inference request limit has been reached.",
        );
      }

      reply.code(response.statusCode);
      for (const [name, value] of Object.entries(response.headers)) {
        reply.header(name, value);
      }
      return reply.send(response.body);
    },
  );

  app.addHook("preClose", async () => {
    shutdownController.abort();
  });

  app.addHook("onClose", async () => {
    await provider.close();
  });

  return app;
}

function sendLocalError(reply: FastifyReply, error: TokenShuffleError): void {
  reply
    .header("x-token-shuffle-error", "true")
    .code(error.statusCode)
    .send(errorEnvelope(error));
}
