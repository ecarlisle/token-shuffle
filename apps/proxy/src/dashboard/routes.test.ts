import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { createDashboardBootstrap } from "../auth/admin-session.js";
import type { RuntimeConfig } from "../config/schema.js";
import type { ObservationEvent } from "../observation/events.js";

const directories: string[] = [];
const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("dashboard routes", () => {
  it("requires a single-use bootstrap and a separate administrative cookie", async () => {
    const directory = await mkdtemp(join(tmpdir(), "token-shuffle-dashboard-"));
    directories.push(directory);
    const config = createConfig(join(directory, "events.sqlite"));
    const eventReader = { list: async (): Promise<ObservationEvent[]> => [] };
    const app = buildApp(config, { eventReader });
    apps.push(app);
    const bootstrap = await createDashboardBootstrap(config.storage.path);

    const bearerOnly = await app.inject({
      method: "GET",
      url: "/api/dashboard/overview",
      headers: { authorization: "Bearer local-test-token" },
    });
    const wrongOrigin = await app.inject({
      method: "POST",
      url: "/api/admin/session",
      headers: {
        "content-type": "application/json",
        origin: "https://malicious.example",
      },
      payload: JSON.stringify({ code: bootstrap.code }),
    });
    const exchange = await app.inject({
      method: "POST",
      url: "/api/admin/session",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1:3210",
      },
      payload: JSON.stringify({ code: bootstrap.code }),
    });
    const cookie = exchange.headers["set-cookie"]?.split(";")[0];
    const overview = await app.inject({
      method: "GET",
      url: "/api/dashboard/overview",
      headers: { cookie: cookie ?? "" },
    });
    const reused = await app.inject({
      method: "POST",
      url: "/api/admin/session",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1:3210",
      },
      payload: JSON.stringify({ code: bootstrap.code }),
    });

    expect(bearerOnly.statusCode).toBe(401);
    expect(wrongOrigin.statusCode).toBe(403);
    expect(exchange.statusCode).toBe(200);
    expect(exchange.headers["set-cookie"]).toContain("HttpOnly");
    expect(overview.statusCode).toBe(200);
    expect(overview.json()).toMatchObject({
      summary: { requests: 0, sessions: 0 },
      system: { version: "0.2.0-dev.0" },
    });
    expect(reused.statusCode).toBe(401);
  });

  it("serves the built dashboard shell without exposing history", async () => {
    const directory = await mkdtemp(join(tmpdir(), "token-shuffle-web-"));
    directories.push(directory);
    await writeFile(join(directory, "index.html"), "<!doctype html><title>Dashboard shell</title>");
    const config = createConfig(join(directory, "events.sqlite"));
    const app = buildApp(config, { webRoot: directory });
    apps.push(app);

    const shell = await app.inject({ method: "GET", url: "/" });
    const history = await app.inject({ method: "GET", url: "/api/dashboard/overview" });

    expect(shell.statusCode).toBe(200);
    expect(shell.body).toContain("Dashboard shell");
    expect(shell.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(shell.headers["x-frame-options"]).toBe("DENY");
    expect(history.statusCode).toBe(401);
  });
});

function createConfig(storagePath: string): RuntimeConfig {
  return {
    configVersion: 1,
    mode: "observe",
    server: { host: "127.0.0.1", port: 3210 },
    auth: { accessToken: "local-test-token" },
    upstream: {
      type: "openai-compatible",
      baseUrl: new URL("http://127.0.0.1:43210/v1/"),
      apiKey: "provider-test-key",
    },
    storage: {
      retainRawContent: false,
      path: storagePath,
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
    },
  };
}
