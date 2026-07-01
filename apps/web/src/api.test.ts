import { afterEach, describe, expect, it, vi } from "vitest";

import { exchangeBootstrap, loadOverview } from "./api.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dashboard API client", () => {
  it("exchanges a bootstrap using same-origin credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ authenticated: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await exchangeBootstrap("single-use-code");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/session",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ code: "single-use-code" }),
      }),
    );
  });

  it("distinguishes an expired administrative session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "admin_session_required" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(loadOverview()).rejects.toEqual(
      expect.objectContaining({
        name: "ApiError",
        status: 401,
      }),
    );
  });
});
