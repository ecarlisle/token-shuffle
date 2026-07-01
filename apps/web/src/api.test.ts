import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deleteRequestEvidence,
  exchangeBootstrap,
  loadOverview,
  loadRequest,
} from "./api.js";

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

  it("encodes detail identifiers and sends same-origin retention mutations", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ id: "request/one" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await loadRequest("request/one");
    await deleteRequestEvidence("request/one");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/dashboard/requests/request%2Fone",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/dashboard/requests/request%2Fone",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
  });
});
