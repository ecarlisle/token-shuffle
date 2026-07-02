import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { createDashboardBootstrap } from "./auth/admin-session.js";
import type { RuntimeConfig } from "./config/schema.js";
import type { EventSink, ObservationEvent } from "./observation/events.js";

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

const apps: ReturnType<typeof buildApp>[] = [];
const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error === undefined ? resolve() : reject(error)));
          server.closeAllConnections();
        }),
    ),
  );
});

async function startProvider(handler: Handler): Promise<URL> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return new URL(`http://127.0.0.1:${address.port}/v1/`);
}

function createConfig(baseUrl: URL, limits?: Partial<RuntimeConfig["limits"]>): RuntimeConfig {
  return {
    configVersion: 1,
    mode: "observe",
    server: { host: "127.0.0.1", port: 3210 },
    auth: { accessToken: "local-test-token" },
    upstream: {
      type: "openai-compatible",
      baseUrl,
      apiKey: "provider-test-key",
    },
    storage: {
      retainRawContent: false,
      path: ":memory:",
      structuralRetentionDays: 30,
      errorRetentionDays: 14,
    },
    limits: {
      requestBodyBytes: 16 * 1024 * 1024,
      requestHeaderBytes: 16 * 1024,
      concurrentInferenceRequests: 16,
      upstreamConnectTimeoutMs: 1_000,
      responseHeaderTimeoutMs: 1_000,
      responseBodyTimeoutMs: 1_000,
      sseEventBytes: 8 * 1024 * 1024,
      ...limits,
    },
  };
}

function authorizedHeaders(): Record<string, string> {
  return {
    authorization: "Bearer local-test-token",
    "content-type": "application/json",
  };
}

class RecordingEventSink implements EventSink {
  public readonly events: ObservationEvent[] = [];

  public async append(event: ObservationEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("proxy authentication", () => {
  it("requires the local bearer token without contacting the provider", async () => {
    let providerCalls = 0;
    const baseUrl = await startProvider((_request, response) => {
      providerCalls += 1;
      response.end("{}");
    });
    const app = buildApp(createConfig(baseUrl));
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: { "content-type": "application/json" },
      payload: '{"model":"test","messages":[]}',
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers["x-token-shuffle-error"]).toBe("true");
    expect(response.json()).toMatchObject({
      error: { type: "token_shuffle_error", code: "invalid_authorization" },
    });
    expect(providerCalls).toBe(0);
  });

  it("protects the redacted status endpoint", async () => {
    const baseUrl = await startProvider((_request, response) => response.end("{}"));
    const app = buildApp(createConfig(baseUrl));
    apps.push(app);

    const denied = await app.inject({ method: "GET", url: "/_token-shuffle/status" });
    const allowed = await app.inject({
      method: "GET",
      url: "/_token-shuffle/status",
      headers: { authorization: "Bearer local-test-token" },
    });

    expect(denied.statusCode).toBe(401);
    expect(allowed.json()).toMatchObject({
      mode: "observe",
      ready: true,
      streaming: true,
    });
  });

  it("rejects browser-origin inference even with a valid agent token", async () => {
    let providerCalls = 0;
    const baseUrl = await startProvider((_request, response) => {
      providerCalls += 1;
      response.end("{}");
    });
    const app = buildApp(createConfig(baseUrl));
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: { ...authorizedHeaders(), origin: "https://malicious.example" },
      payload: '{"model":"test","messages":[]}',
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["x-token-shuffle-error"]).toBe("true");
    expect(providerCalls).toBe(0);
  });
});

describe("buffered Chat Completions forwarding", () => {
  it("preserves raw JSON bytes and replaces local authorization", async () => {
    const rawBody =
      '{\n  "model": "test-model", "messages": [], "unknown": {"kept": true}\n}\n';
    let receivedBody: Buffer | undefined;
    let receivedAuthorization: string | undefined;
    let receivedInternalHeader: string | undefined;
    const providerBody = Buffer.from('{\n "id": "provider-response", "choices": []\n}\n');
    const baseUrl = await startProvider((request, response) => {
      receivedAuthorization = request.headers.authorization;
      const internalHeader = request.headers["x-token-shuffle-session-id"];
      receivedInternalHeader =
        typeof internalHeader === "string" ? internalHeader : internalHeader?.[0];
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        receivedBody = Buffer.concat(chunks);
        response.writeHead(201, {
          "content-type": "application/json; charset=utf-8",
          "x-request-id": "provider-request-id",
          "set-cookie": "must-not-leak=true",
        });
        response.end(providerBody);
      });
    });
    const eventSink = new RecordingEventSink();
    const app = buildApp(createConfig(baseUrl), { eventSink });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        ...authorizedHeaders(),
        "x-token-shuffle-session-id": "explicit-session",
      },
      payload: rawBody,
    });

    expect(response.statusCode).toBe(201);
    expect(response.rawPayload).toEqual(providerBody);
    expect(response.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(response.headers["x-request-id"]).toBe("provider-request-id");
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(receivedBody).toEqual(Buffer.from(rawBody));
    expect(receivedAuthorization).toBe("Bearer provider-test-key");
    expect(receivedAuthorization).not.toContain("local-test-token");
    expect(receivedInternalHeader).toBeUndefined();
    await new Promise((resolve) => setImmediate(resolve));
    expect(eventSink.events.map((event) => event.type)).toEqual([
      "request.received",
      "request.measured",
      "policy.shadow_evaluated",
      "policy.shadow_evaluated",
      "policy.shadow_evaluated",
      "route.selected",
      "attempt.started",
      "attempt.first_byte",
      "attempt.usage",
      "attempt.completed",
      "request.completed",
    ]);
    expect(eventSink.events[0]?.session).toEqual({
      id: "explicit-session",
      association: "explicit",
      method: "x-token-shuffle-session-id",
    });
    expect(
      eventSink.events.filter((event) => event.type === "policy.shadow_evaluated"),
    ).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          applied: false,
          policy: "exact-redundancy",
          policyVersion: "shadow-v1",
        }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({
          applied: false,
          policy: "tool-output-compaction",
          policyVersion: "shadow-v1",
        }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({
          applied: false,
          policy: "dynamic-tool-definition-selection",
          policyVersion: "shadow-v1",
          retryCount: 0,
        }),
      }),
    ]);
    expect(JSON.stringify(eventSink.events)).not.toContain(rawBody);
  });

  it("observes the inbound developer role but normalizes it only for dispatch", async () => {
    const rawBody = JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "existing system instruction" },
        { role: "developer", content: "developer instruction", name: "opencode" },
        { role: "user", content: "question" },
        { role: "assistant", content: "answer" },
        { role: "tool", content: "result", tool_call_id: "call-1" },
      ],
      unknown: { kept: true },
    });
    let receivedBody = Buffer.alloc(0);
    const baseUrl = await startProvider((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        receivedBody = Buffer.concat(chunks);
        response.end('{"choices":[]}');
      });
    });
    const eventSink = new RecordingEventSink();
    const config = createConfig(baseUrl);
    const app = buildApp(
      {
        ...config,
        upstream: {
          ...config.upstream,
          compatibility: { developerRole: "system" },
        },
      },
      { eventSink },
    );
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: authorizedHeaders(),
      payload: rawBody,
    });

    expect(response.statusCode).toBe(200);
    const forwarded = JSON.parse(receivedBody.toString("utf8")) as {
      messages: { role: string; content: string; name?: string }[];
      unknown: { kept: boolean };
    };
    expect(forwarded.messages.map((message) => message.role)).toEqual([
      "system",
      "system",
      "user",
      "assistant",
      "tool",
    ]);
    expect(forwarded.messages[1]).toEqual({
      role: "system",
      content: "developer instruction",
      name: "opencode",
    });
    expect(forwarded.unknown).toEqual({ kept: true });
    await new Promise((resolve) => setImmediate(resolve));
    expect(eventSink.events[0]).toMatchObject({
      type: "request.received",
      data: { requestBytes: Buffer.byteLength(rawBody) },
    });
    expect(eventSink.events.find((event) => event.type === "request.measured")).toMatchObject({
      data: {
        developerMessageCount: 1,
        messageCount: 5,
        forwardedInputTokens: Math.ceil(receivedBody.byteLength / 4),
      },
    });
  });

  it("injects session-scoped retrieval on the next client turn without retrying", async () => {
    const providerBodies: Buffer[] = [];
    const baseUrl = await startProvider((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        providerBodies.push(Buffer.concat(chunks));
        response.end('{"choices":[{"message":{"role":"assistant","content":"done"}}]}');
      });
    });
    const eventSink = new RecordingEventSink();
    const searches: Array<{ sessionId: string; query: string; limit: number }> = [];
    const eventReader = {
      list: async (): Promise<ObservationEvent[]> => [],
      searchArtifacts: async (sessionId: string, query: string, limit: number) => {
        searches.push({ sessionId, query, limit });
        return [
          {
            artifactId:
              "hmac-sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            kind: "file" as const,
            content: "src/auth/session.ts validates bootstrap tokens",
            contentBytes: 47,
          },
        ];
      },
    };
    const config: RuntimeConfig = {
      ...createConfig(baseUrl),
      mode: "optimize",
      policies: {
        killSwitch: false,
        toolOutput: {
          enabled: false,
          collapseRepeatedLinesAfter: 3,
          maximumInputCharacters: 65_536,
        },
        exactRedundancy: { enabled: false },
        conversationCompaction: {
          enabled: false,
          minimumMessages: 12,
          activeWindowMessages: 6,
          maximumSourceCharacters: 256_000,
        },
        retrieval: {
          enabled: true,
          maximumResults: 3,
          maximumInjectedCharacters: 24_000,
        },
      },
    };
    const app = buildApp(config, { eventSink, eventReader });
    apps.push(app);
    const inbound = {
      model: "test-model",
      messages: [
        {
          role: "assistant",
          content: 'I need token_shuffle_retrieve("src/auth/session.ts bootstrap")',
        },
        { role: "user", content: "Continue." },
      ],
    };

    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        ...authorizedHeaders(),
        "x-token-shuffle-session-id": "retrieval-session",
      },
      payload: JSON.stringify(inbound),
    });

    expect(response.statusCode).toBe(200);
    expect(searches).toEqual([
      {
        sessionId: "retrieval-session",
        query: "src/auth/session.ts bootstrap",
        limit: 3,
      },
    ]);
    expect(providerBodies).toHaveLength(1);
    const forwarded = JSON.parse(providerBodies[0]?.toString("utf8") ?? "{}") as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(forwarded.messages).toContainEqual(
      expect.objectContaining({
        role: "developer",
        content: expect.stringContaining(
          "src/auth/session.ts validates bootstrap tokens",
        ),
      }),
    );
    expect(forwarded.messages).toContainEqual(inbound.messages[0]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(
      eventSink.events.find((event) => event.type === "retrieval.completed"),
    ).toMatchObject({
      data: {
        hit: true,
        resultCount: 1,
        retryCount: 0,
        provenance: "estimate",
      },
    });
    expect(
      eventSink.events.filter((event) => event.type === "attempt.started"),
    ).toHaveLength(1);
  });

  it("fails open without retry when artifact search fails", async () => {
    let receivedBody = Buffer.alloc(0);
    let providerCalls = 0;
    const baseUrl = await startProvider((request, response) => {
      providerCalls += 1;
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        receivedBody = Buffer.concat(chunks);
        response.end('{"choices":[]}');
      });
    });
    const eventSink = new RecordingEventSink();
    const eventReader = {
      list: async (): Promise<ObservationEvent[]> => [],
      searchArtifacts: async (): Promise<never> => {
        throw new Error("synthetic storage failure");
      },
    };
    const config: RuntimeConfig = {
      ...createConfig(baseUrl),
      mode: "optimize",
      policies: {
        killSwitch: false,
        toolOutput: {
          enabled: false,
          collapseRepeatedLinesAfter: 3,
          maximumInputCharacters: 65_536,
        },
        exactRedundancy: { enabled: false },
        conversationCompaction: {
          enabled: false,
          minimumMessages: 12,
          activeWindowMessages: 6,
          maximumSourceCharacters: 256_000,
        },
        retrieval: {
          enabled: true,
          maximumResults: 3,
          maximumInjectedCharacters: 24_000,
        },
      },
    };
    const app = buildApp(config, { eventSink, eventReader });
    apps.push(app);
    const rawBody =
      '{"model":"test","messages":[{"role":"assistant","content":"token_shuffle_retrieve(\\\"missing\\\")"},{"role":"user","content":"continue"}],"unknown":true}';

    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: authorizedHeaders(),
      payload: rawBody,
    });

    expect(response.statusCode).toBe(200);
    expect(providerCalls).toBe(1);
    expect(receivedBody).toEqual(Buffer.from(rawBody));
    await new Promise((resolve) => setImmediate(resolve));
    expect(
      eventSink.events.find((event) => event.type === "retrieval.completed"),
    ).toMatchObject({
      data: { failed: true, hit: false, resultCount: 0, retryCount: 0 },
    });
  });

  it("applies explicitly enabled deterministic policies and records final-boundary impact", async () => {
    let receivedBody = Buffer.alloc(0);
    const baseUrl = await startProvider((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        receivedBody = Buffer.concat(chunks);
        response.end('{"choices":[],"usage":{"prompt_tokens":20,"completion_tokens":1}}');
      });
    });
    const eventSink = new RecordingEventSink();
    const config: RuntimeConfig = {
      ...createConfig(baseUrl),
      mode: "optimize",
      policies: {
        killSwitch: false,
        toolOutput: {
          enabled: true,
          collapseRepeatedLinesAfter: 3,
          maximumInputCharacters: 65_536,
        },
        exactRedundancy: { enabled: true },
        conversationCompaction: {
          enabled: false,
          minimumMessages: 12,
          activeWindowMessages: 6,
          maximumSourceCharacters: 256_000,
        },
      },
    };
    const app = buildApp(config, { eventSink });
    apps.push(app);
    const duplicate = {
      role: "tool",
      tool_call_id: "call-1",
      content: "\u001b[31mfailed\u001b[0m\nsame\nsame\nsame",
    };
    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: authorizedHeaders(),
      payload: JSON.stringify({
        model: "test",
        messages: [{ role: "user", content: "test" }, duplicate, duplicate],
      }),
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(response.statusCode).toBe(200);
    const forwarded = JSON.parse(receivedBody.toString("utf8")) as {
      messages: Array<{ content: string }>;
    };
    expect(forwarded.messages).toHaveLength(2);
    expect(forwarded.messages[1]?.content).not.toContain("\u001b");
    expect(forwarded.messages[1]?.content).toContain("occurred 3 times");
    expect(
      eventSink.events.filter((event) => event.type === "policy.applied"),
    ).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({ applied: true, policy: "tool-output" }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({ applied: true, policy: "exact-redundancy" }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({
          applied: false,
          policy: "conversation-compaction",
          reason: "disabled",
        }),
      }),
    ]);
    expect(
      eventSink.events.find((event) => event.type === "request.measured")?.data,
    ).toEqual(
      expect.objectContaining({
        literalInputTokensAvoided: expect.any(Number),
        netTokensAvoided: expect.any(Number),
        optimizationTokens: 0,
      }),
    );
  });

  it("compacts eligible old turns once while retaining system and active-window messages", async () => {
    let receivedBody = Buffer.alloc(0);
    let providerCalls = 0;
    const baseUrl = await startProvider((request, response) => {
      providerCalls += 1;
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        receivedBody = Buffer.concat(chunks);
        response.end('{"choices":[]}');
      });
    });
    const eventSink = new RecordingEventSink();
    const artifacts: Array<{
      artifactId: string;
      requestId: string;
      sessionId: string;
      kind: "conversation" | "tool-output" | "file";
      content: string;
      createdAt: string;
    }> = [];
    const eventReader = {
      list: async (): Promise<ObservationEvent[]> => [],
      putArtifact: async (artifact: (typeof artifacts)[number]) => {
        artifacts.push(artifact);
      },
      searchArtifacts: async (sessionId: string, query: string, limit: number) =>
        artifacts
          .filter(
            (artifact) =>
              artifact.sessionId === sessionId &&
              (artifact.artifactId === query || artifact.content.includes(query)),
          )
          .slice(0, limit)
          .map((artifact) => ({
            artifactId: artifact.artifactId,
            kind: artifact.kind,
            content: artifact.content,
            contentBytes: Buffer.byteLength(artifact.content),
          })),
    };
    const config: RuntimeConfig = {
      ...createConfig(baseUrl),
      mode: "optimize",
      policies: {
        killSwitch: false,
        toolOutput: {
          enabled: false,
          collapseRepeatedLinesAfter: 3,
          maximumInputCharacters: 65_536,
        },
        exactRedundancy: { enabled: false },
        conversationCompaction: {
          enabled: true,
          minimumMessages: 8,
          activeWindowMessages: 2,
          maximumSourceCharacters: 256_000,
        },
        retrieval: {
          enabled: true,
          maximumResults: 3,
          maximumInjectedCharacters: 512,
        },
      },
    };
    const app = buildApp(config, { eventSink, eventReader });
    apps.push(app);
    const messages = [
      { role: "system", content: "Always preserve compatibility." },
      ...Array.from({ length: 8 }, (_value, index) => ({
        role: index % 2 === 0 ? "user" : "assistant",
        content: `Turn ${index}. ${index === 0 ? "Must retain tests." : ""}\n${"background ".repeat(80)}`,
      })),
      { role: "user", content: "This active request stays verbatim." },
      { role: "assistant", content: "This active answer stays verbatim." },
    ];
    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        ...authorizedHeaders(),
        "x-token-shuffle-session-id": "compaction-session",
      },
      payload: JSON.stringify({ model: "test", messages }),
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(response.statusCode).toBe(200);
    expect(providerCalls).toBe(1);
    const forwarded = JSON.parse(receivedBody.toString("utf8")) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(forwarded.messages[0]).toEqual(messages[0]);
    expect(forwarded.messages.slice(-2)).toEqual(messages.slice(-2));
    expect(
      forwarded.messages.some((message) =>
        message.content.includes("Token Shuffle deterministic compacted state."),
      ),
    ).toBe(true);
    expect(
      eventSink.events.find(
        (event) =>
          event.type === "policy.applied" &&
          event.data.policy === "conversation-compaction",
      )?.data,
    ).toEqual(
      expect.objectContaining({
        applied: true,
        optimizationTokens: 0,
        sourceFingerprint: expect.stringMatching(/^hmac-sha256-[0-9a-f]{64}$/),
        summaryVersion: "deterministic-v1",
      }),
    );
    expect(
      eventSink.events.find((event) => event.type === "request.measured")?.data,
    ).toEqual(
      expect.objectContaining({
        netTokensAvoided: expect.any(Number),
        optimizationTokens: 0,
      }),
    );
    const fingerprint = eventSink.events.find(
      (event) =>
        event.type === "policy.applied" &&
        event.data.policy === "conversation-compaction",
    )?.data.sourceFingerprint;
    expect(fingerprint).toEqual(
      expect.stringMatching(/^hmac-sha256-[0-9a-f]{64}$/),
    );
    expect(artifacts).toEqual([
      expect.objectContaining({
        artifactId: fingerprint,
        kind: "conversation",
        content: expect.stringContaining("Must retain tests"),
      }),
    ]);
    expect(
      eventSink.events.find((event) => event.type === "artifact.externalized"),
    ).toMatchObject({
      data: {
        artifactId: fingerprint,
        artifactKind: "conversation",
      },
    });
    const retrievalResponse = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        ...authorizedHeaders(),
        "x-token-shuffle-session-id": "compaction-session",
      },
      payload: JSON.stringify({
        model: "test",
        messages: [
          {
            role: "assistant",
            content: `token_shuffle_retrieve("${String(fingerprint)}")`,
          },
          { role: "user", content: "Use the requested context and continue." },
        ],
      }),
    });
    expect(retrievalResponse.statusCode).toBe(200);
    expect(providerCalls).toBe(2);
    await new Promise((resolve) => setImmediate(resolve));
    const sessionMeasurements = eventSink.events.filter(
      (event) =>
        event.type === "request.measured" &&
        event.session.id === "compaction-session",
    );
    const sessionNet = sessionMeasurements.reduce(
      (total, event) =>
        total +
        Number(event.data.baselineInputTokens ?? 0) -
        Number(event.data.forwardedInputTokens ?? 0),
      0,
    );
    expect(sessionMeasurements).toHaveLength(2);
    expect(sessionNet).toBeGreaterThan(0);
    expect(
      eventSink.events.find(
        (event) =>
          event.type === "retrieval.completed" &&
          event.session.id === "compaction-session",
      ),
    ).toMatchObject({
      data: { hit: true, retryCount: 0, injectedCharacters: 512 },
    });
    const bootstrap = await createDashboardBootstrap(config.storage.path);
    const exchange = await app.inject({
      method: "POST",
      url: "/api/admin/session",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1:3210",
      },
      payload: JSON.stringify({ code: bootstrap.code }),
    });
    const recovery = await app.inject({
      method: "GET",
      url: `/api/dashboard/compaction/${String(fingerprint)}/source`,
      headers: { cookie: exchange.headers["set-cookie"]?.split(";")[0] ?? "" },
    });
    expect(recovery.statusCode).toBe(200);
    expect(recovery.json()).toMatchObject({
      fingerprint,
      retention: "memory-only",
      source: expect.arrayContaining([
        expect.objectContaining({ content: expect.stringContaining("Must retain tests") }),
      ]),
    });
    const requestId = eventSink.events[0]?.requestId ?? "";
    await app.inject({
      method: "DELETE",
      url: `/api/dashboard/requests/${requestId}`,
      headers: {
        cookie: exchange.headers["set-cookie"]?.split(";")[0] ?? "",
        origin: "http://127.0.0.1:3210",
      },
    });
    const deletedRecovery = await app.inject({
      method: "GET",
      url: `/api/dashboard/compaction/${String(fingerprint)}/source`,
      headers: { cookie: exchange.headers["set-cookie"]?.split(";")[0] ?? "" },
    });
    expect(deletedRecovery.statusCode).toBe(404);
  });

  it("preserves provider error status and body", async () => {
    const providerBody = Buffer.from('{"error":{"message":"synthetic rate limit"}}');
    const baseUrl = await startProvider((_request, response) => {
      response.writeHead(429, {
        "content-type": "application/json",
        "retry-after": "3",
      });
      response.end(providerBody);
    });
    const app = buildApp(createConfig(baseUrl));
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: authorizedHeaders(),
      payload: '{"model":"test","messages":[]}',
    });

    expect(response.statusCode).toBe(429);
    expect(response.rawPayload).toEqual(providerBody);
    expect(response.headers["retry-after"]).toBe("3");
    expect(response.headers["x-token-shuffle-error"]).toBeUndefined();
  });

  it("preserves SSE bytes and event boundaries", async () => {
    const chunks = [
      Buffer.from("event: message\r\n"),
      Buffer.from('data: {"choices":[{"delta":{"content":"OK"}}]}\r\n\r\n'),
      Buffer.from("data: [DONE]\r\n\r\n"),
    ];
    const baseUrl = await startProvider((_request, response) => {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "x-request-id": "stream-request-id",
      });
      response.write(chunks[0]);
      setImmediate(() => {
        response.write(chunks[1]);
        response.end(chunks[2]);
      });
    });
    const app = buildApp(createConfig(baseUrl));
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: authorizedHeaders(),
      payload: '{"model":"test","messages":[],"stream":true}',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/event-stream");
    expect(response.headers["x-request-id"]).toBe("stream-request-id");
    expect(response.rawPayload).toEqual(Buffer.concat(chunks));
  });

  it("rejects malformed and oversized input before dispatch", async () => {
    let providerCalls = 0;
    const baseUrl = await startProvider((_request, response) => {
      providerCalls += 1;
      response.end("{}");
    });
    const app = buildApp(createConfig(baseUrl, { requestBodyBytes: 64 }));
    apps.push(app);

    const malformed = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: authorizedHeaders(),
      payload: '{"model":',
    });
    const oversized = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: authorizedHeaders(),
      payload: JSON.stringify({
        model: "test",
        messages: [],
        padding: "x".repeat(100),
      }),
    });

    expect(malformed.statusCode).toBe(400);
    expect(oversized.statusCode).toBe(413);
    expect(providerCalls).toBe(0);
  });

  it("does not retry an upstream transport failure", async () => {
    let providerCalls = 0;
    const baseUrl = await startProvider((request) => {
      providerCalls += 1;
      request.socket.destroy();
    });
    const app = buildApp(createConfig(baseUrl));
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: authorizedHeaders(),
      payload: '{"model":"test","messages":[]}',
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({
      error: { type: "token_shuffle_error", code: "upstream_unavailable" },
    });
    expect(providerCalls).toBe(1);
  });

  it("aborts upstream work when the client disconnects", async () => {
    let markUpstreamStarted: (() => void) | undefined;
    const upstreamStarted = new Promise<void>((resolve) => {
      markUpstreamStarted = resolve;
    });
    let markUpstreamClosed: (() => void) | undefined;
    const upstreamClosed = new Promise<void>((resolve) => {
      markUpstreamClosed = resolve;
    });
    const baseUrl = await startProvider((_request, response) => {
      markUpstreamStarted?.();
      response.once("close", () => markUpstreamClosed?.());
    });
    const app = buildApp(createConfig(baseUrl));
    apps.push(app);
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address() as AddressInfo;

    const clientRequest = httpRequest({
      host: "127.0.0.1",
      port: address.port,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        ...authorizedHeaders(),
        "content-length": Buffer.byteLength('{"model":"test","messages":[]}'),
      },
    });
    clientRequest.on("error", () => undefined);
    clientRequest.end('{"model":"test","messages":[]}');
    await upstreamStarted;
    clientRequest.destroy();

    await expect(
      Promise.race([
        upstreamClosed,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Upstream was not aborted.")), 1_000),
        ),
      ]),
    ).resolves.toBeUndefined();
  });

  it("rejects concurrent work beyond the configured limit", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstReceived = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let providerCalls = 0;
    const baseUrl = await startProvider((_request, response) => {
      providerCalls += 1;
      if (providerCalls === 1) {
        void firstReceived.then(() => response.end('{"choices":[]}'));
      } else {
        response.end('{"choices":[]}');
      }
    });
    const app = buildApp(
      createConfig(baseUrl, { concurrentInferenceRequests: 1 }),
    );
    apps.push(app);

    const first = app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: authorizedHeaders(),
      payload: '{"model":"test","messages":[]}',
    });
    await new Promise((resolve) => setImmediate(resolve));
    const second = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: authorizedHeaders(),
      payload: '{"model":"test","messages":[]}',
    });
    releaseFirst?.();
    const completedFirst = await first;

    expect(second.statusCode).toBe(429);
    expect(second.headers["x-token-shuffle-error"]).toBe("true");
    expect(completedFirst.statusCode).toBe(200);
    expect(providerCalls).toBe(1);
  });
});

describe("model discovery", () => {
  it("forwards authenticated model discovery with only the upstream credential", async () => {
    let authorization: string | undefined;
    let method: string | undefined;
    let path: string | undefined;
    const providerBody = Buffer.from('{"object":"list","data":[]}');
    const baseUrl = await startProvider((request, response) => {
      authorization = request.headers.authorization;
      method = request.method;
      path = request.url;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(providerBody);
    });
    const app = buildApp(createConfig(baseUrl));
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/models",
      headers: { authorization: "Bearer local-test-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.rawPayload).toEqual(providerBody);
    expect(authorization).toBe("Bearer provider-test-key");
    expect(method).toBe("GET");
    expect(path).toBe("/v1/models");
  });
});
