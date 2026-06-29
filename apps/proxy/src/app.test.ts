import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("status endpoint", () => {
  it("reports foundation mode without exposing an inference route", async () => {
    const app = buildApp();
    apps.push(app);

    const status = await app.inject({
      method: "GET",
      url: "/_token-shuffle/status",
    });
    const inference = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
    });

    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      mode: "foundation",
      ready: true,
    });
    expect(inference.statusCode).toBe(404);
  });
});
