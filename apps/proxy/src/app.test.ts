import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { RuntimeConfig } from "./config/schema.js";

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
    storage: { retainRawContent: false },
    limits: {
      requestBodyBytes: 16 * 1024 * 1024,
      requestHeaderBytes: 16 * 1024,
      concurrentInferenceRequests: 16,
      upstreamConnectTimeoutMs: 1_000,
      responseHeaderTimeoutMs: 1_000,
      responseBodyTimeoutMs: 1_000,
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
      streaming: false,
    });
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
      const internalHeader = request.headers["x-token-shuffle-session"];
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
    const app = buildApp(createConfig(baseUrl));
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        ...authorizedHeaders(),
        "x-token-shuffle-session": "local-only",
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

  it("rejects malformed, unsupported, and oversized input before dispatch", async () => {
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
    const streaming = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: authorizedHeaders(),
      payload: '{"model":"test","messages":[],"stream":true}',
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
    expect(streaming.statusCode).toBe(501);
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
