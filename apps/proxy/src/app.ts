import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import fastifyStatic from "@fastify/static";
import { once } from "node:events";

import { ExecutionCoordinator } from "./application/execution-coordinator.js";
import { AdminSessionManager } from "./auth/admin-session.js";
import { hasValidBearerToken } from "./auth/bearer-auth.js";
import type { RuntimeConfig } from "./config/schema.js";
import {
  projectDashboard,
  projectRequest,
  projectSession,
} from "./dashboard/projection.js";
import { errorEnvelope, TokenShuffleError } from "./errors.js";
import {
  NoopEventSink,
  ObservableEventSink,
  ResilientEventSink,
  type EventSink,
  type ObservationEvent,
} from "./observation/events.js";
import {
  parseRawJsonBody,
  isStreamingRequest,
  type RawJsonBody,
  validateChatCompletionsRequest,
} from "./protocol/openai/chat-completions.js";
import { OpenAiCompatibleProvider } from "./providers/openai-compatible.js";
import type {
  ArtifactMatch,
  ContextArtifact,
} from "./storage/event-store.js";

export interface DashboardEventStore {
  list(): Promise<ObservationEvent[]>;
  deleteRequest?(requestId: string): Promise<number>;
  deleteSession?(sessionId: string): Promise<number>;
  deleteAll?(): Promise<number>;
  diagnostics?(): Promise<{
    readonly sqliteVersion: string;
    readonly eventCount: number;
    readonly artifactCount?: number;
  }>;
  putArtifact?(artifact: ContextArtifact): Promise<void>;
  searchArtifacts?(
    sessionId: string,
    query: string,
    limit: number,
  ): Promise<ArtifactMatch[]>;
}

export function buildApp(
  config: RuntimeConfig,
  options: {
    readonly eventSink?: EventSink;
    readonly eventReader?: DashboardEventStore;
    readonly logging?: boolean;
    readonly webRoot?: string;
  } = {},
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
    developerRole: config.upstream.compatibility?.developerRole ?? "preserve",
  });
  const resilientEventSink = new ResilientEventSink(
    options.eventSink ?? new NoopEventSink(),
  );
  const eventSink = new ObservableEventSink(resilientEventSink);
  const coordinator = new ExecutionCoordinator(
    provider,
    config.limits.concurrentInferenceRequests,
    eventSink,
    config.mode,
    config.policies,
    config.storage.contentFingerprintKey ?? config.auth.accessToken,
    options.eventReader,
    config.policies?.retrieval,
  );
  const shutdownController = new AbortController();
  const adminSessions = new AdminSessionManager(config.storage.path);
  const dashboardOrigin = `http://${config.server.host}:${config.server.port}`;

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
      mode: config.mode,
      name: "token-shuffle",
      phase: "v0.4",
      persistence: resilientEventSink.health,
      ready: true,
      streaming: true,
      version: "0.4.1",
    }),
  );

  if (options.webRoot !== undefined) {
    void app.register(fastifyStatic, {
      root: options.webRoot,
      prefix: "/",
      wildcard: false,
      setHeaders(response, path) {
        response.setHeader("x-content-type-options", "nosniff");
        response.setHeader("x-frame-options", "DENY");
        response.setHeader("referrer-policy", "no-referrer");
        if (path.endsWith(".html")) {
          response.setHeader(
            "content-security-policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
              "connect-src 'self'; img-src 'self' data:; font-src 'self'; " +
              "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
          );
          response.setHeader("cache-control", "no-store");
        }
      },
    });
    const sendDashboardShell = async (
      _request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<FastifyReply> => reply.sendFile("index.html");
    app.get("/diagnostics", sendDashboardShell);
    app.get("/requests/*", sendDashboardShell);
    app.get("/sessions/*", sendDashboardShell);
  }

  const requireDashboardOrigin = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (request.headers.origin !== dashboardOrigin) {
      sendDashboardError(reply, 403, "invalid_origin", "Dashboard origin is not allowed.");
    }
  };

  const authenticateDashboard = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!adminSessions.authenticate(request.headers.cookie)) {
      sendDashboardError(
        reply,
        401,
        "admin_session_required",
        "Open the dashboard through `token-shuffle open`.",
      );
    }
  };

  app.post<{ Body: RawJsonBody }>(
    "/api/admin/session",
    { preHandler: requireDashboardOrigin },
    async (request, reply) => {
      const code = readBootstrapCode(request.body);
      if (code === undefined) {
        sendDashboardError(reply, 400, "invalid_bootstrap", "Bootstrap code is required.");
        return;
      }
      const token = await adminSessions.exchange(code);
      if (token === undefined) {
        sendDashboardError(
          reply,
          401,
          "invalid_bootstrap",
          "Bootstrap code is invalid, expired, or already used.",
        );
        return;
      }
      reply
        .header("cache-control", "no-store")
        .header("set-cookie", adminSessions.sessionCookie(token))
        .send({ authenticated: true });
    },
  );

  app.delete(
    "/api/admin/session",
    { preHandler: [requireDashboardOrigin, authenticateDashboard] },
    async (request, reply) => {
      adminSessions.revoke(request.headers.cookie);
      reply
        .header("cache-control", "no-store")
        .header("set-cookie", adminSessions.expiredCookie())
        .send({ authenticated: false });
    },
  );

  app.get(
    "/api/dashboard/overview",
    { preHandler: authenticateDashboard },
    async (_request, reply) => {
      const events = (await options.eventReader?.list()) ?? [];
      reply.header("cache-control", "no-store");
      return {
        ...projectDashboard(events),
        system: {
          mode: config.mode,
          persistence: resilientEventSink.health,
          version: "0.4.1",
        },
      };
    },
  );

  app.get<{ Params: { requestId: string } }>(
    "/api/dashboard/requests/:requestId",
    { preHandler: authenticateDashboard },
    async (request, reply) => {
      const detail = projectRequest(
        (await options.eventReader?.list()) ?? [],
        request.params.requestId,
      );
      reply.header("cache-control", "no-store");
      if (detail === undefined) {
        sendDashboardError(reply, 404, "request_not_found", "Request evidence was not found.");
        return;
      }
      return detail;
    },
  );

  app.get<{ Params: { sessionId: string } }>(
    "/api/dashboard/sessions/:sessionId",
    { preHandler: authenticateDashboard },
    async (request, reply) => {
      const detail = projectSession(
        (await options.eventReader?.list()) ?? [],
        request.params.sessionId,
      );
      reply.header("cache-control", "no-store");
      if (detail === undefined) {
        sendDashboardError(reply, 404, "session_not_found", "Session evidence was not found.");
        return;
      }
      return detail;
    },
  );

  app.get<{ Params: { fingerprint: string } }>(
    "/api/dashboard/compaction/:fingerprint/source",
    { preHandler: authenticateDashboard },
    async (request, reply) => {
      if (!/^hmac-sha256-[0-9a-f]{64}$/.test(request.params.fingerprint)) {
        sendDashboardError(
          reply,
          400,
          "invalid_fingerprint",
          "Compaction fingerprint is invalid.",
        );
        return;
      }
      const source = coordinator.compactionSource(request.params.fingerprint);
      reply.header("cache-control", "no-store");
      if (source === undefined) {
        sendDashboardError(
          reply,
          404,
          "compaction_source_unavailable",
          "The memory-only compaction source expired or the proxy restarted.",
        );
        return;
      }
      return {
        fingerprint: request.params.fingerprint,
        retention: "memory-only",
        source,
      };
    },
  );

  app.get(
    "/api/dashboard/diagnostics",
    { preHandler: authenticateDashboard },
    async (_request, reply) => {
      const diagnostics = await options.eventReader?.diagnostics?.();
      reply.header("cache-control", "no-store");
      return {
        mode: config.mode,
        version: "0.4.1",
        phase: "v0.4",
        server: {
          host: config.server.host,
          port: config.server.port,
        },
        storage: {
          path: config.storage.path,
          rawContentRetained: config.storage.retainRawContent,
          artifactContentRetained: config.policies?.retrieval?.enabled ?? false,
          structuralRetentionDays: config.storage.structuralRetentionDays,
          errorRetentionDays: config.storage.errorRetentionDays,
          artifactRetentionDays: config.storage.artifactRetentionDays ?? 7,
          eventCount: diagnostics?.eventCount ?? null,
          artifactCount: diagnostics?.artifactCount ?? null,
          sqliteVersion: diagnostics?.sqliteVersion ?? null,
          degraded: resilientEventSink.health.degraded,
          droppedEvents: resilientEventSink.health.droppedEvents,
        },
        capabilities: {
          ingress: ["openai-chat-completions"],
          providers: ["openai-compatible"],
          streaming: true,
          retries: false,
          retrieval: config.policies?.retrieval?.enabled ?? false,
        },
        policies: {
          mode: config.mode,
          killSwitch: config.policies?.killSwitch ?? false,
          toolOutput: config.policies?.toolOutput ?? {
            enabled: false,
            collapseRepeatedLinesAfter: 3,
            maximumInputCharacters: 64 * 1024,
          },
          exactRedundancy: config.policies?.exactRedundancy ?? { enabled: false },
          conversationCompaction: config.policies?.conversationCompaction ?? {
            enabled: false,
            minimumMessages: 12,
            activeWindowMessages: 6,
            maximumSourceCharacters: 256_000,
          },
          retrieval: config.policies?.retrieval ?? {
            enabled: false,
            maximumResults: 3,
            maximumInjectedCharacters: 24_000,
          },
          dynamicToolDefinitionSelection: {
            mode: "shadow",
            retryCount: 0,
          },
        },
      };
    },
  );

  app.get(
    "/api/dashboard/events",
    { preHandler: authenticateDashboard },
    async (request, reply) => {
      reply.hijack();
      reply.raw.writeHead(200, {
        "cache-control": "no-cache, no-store",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-accel-buffering": "no",
      });
      reply.raw.write("event: ready\ndata: {}\n\n");
      const unsubscribe = eventSink.subscribe((event) => {
        if (!reply.raw.destroyed) {
          reply.raw.write(`event: observation\ndata: ${JSON.stringify(event)}\n\n`);
        }
      });
      const heartbeat = setInterval(() => {
        if (!reply.raw.destroyed) reply.raw.write(": heartbeat\n\n");
      }, 15_000);
      const cleanup = (): void => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      request.raw.once("close", cleanup);
      reply.raw.once("close", cleanup);
    },
  );

  app.delete<{ Params: { requestId: string } }>(
    "/api/dashboard/requests/:requestId",
    { preHandler: [requireDashboardOrigin, authenticateDashboard] },
    async (request, reply) => {
      const deleted =
        (await options.eventReader?.deleteRequest?.(request.params.requestId)) ?? 0;
      coordinator.deleteRequestCompactionSources(request.params.requestId);
      reply.header("cache-control", "no-store");
      return { deletedEvents: deleted };
    },
  );

  app.delete<{ Params: { sessionId: string } }>(
    "/api/dashboard/sessions/:sessionId",
    { preHandler: [requireDashboardOrigin, authenticateDashboard] },
    async (request, reply) => {
      const deleted =
        (await options.eventReader?.deleteSession?.(request.params.sessionId)) ?? 0;
      coordinator.deleteSessionCompactionSources(request.params.sessionId);
      reply.header("cache-control", "no-store");
      return { deletedEvents: deleted };
    },
  );

  app.delete(
    "/api/dashboard/history",
    { preHandler: [requireDashboardOrigin, authenticateDashboard] },
    async (_request, reply) => {
      const deleted = (await options.eventReader?.deleteAll?.()) ?? 0;
      coordinator.clearCompactionSources();
      reply.header("cache-control", "no-store");
      return { deletedEvents: deleted };
    },
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

function sendDashboardError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
): void {
  reply
    .header("cache-control", "no-store")
    .code(statusCode)
    .send({ error: { type: "dashboard_error", code, message } });
}

function readBootstrapCode(body: RawJsonBody): string | undefined {
  if (
    typeof body.parsed === "object" &&
    body.parsed !== null &&
    "code" in body.parsed &&
    typeof body.parsed.code === "string" &&
    body.parsed.code.length <= 128
  ) {
    return body.parsed.code;
  }
  return undefined;
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
