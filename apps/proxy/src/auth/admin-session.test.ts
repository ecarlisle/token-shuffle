import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  AdminSessionManager,
  createDashboardBootstrap,
} from "./admin-session.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("AdminSessionManager", () => {
  it("exchanges a single-use bootstrap for an administrative cookie", async () => {
    const directory = await mkdtemp(join(tmpdir(), "token-shuffle-admin-"));
    directories.push(directory);
    const storagePath = join(directory, "events.sqlite");
    const bootstrap = await createDashboardBootstrap(storagePath);
    const sessions = new AdminSessionManager(storagePath);

    const token = await sessions.exchange(bootstrap.code);
    expect(token).toBeTypeOf("string");
    const cookie = sessions.sessionCookie(token ?? "");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(sessions.authenticate(cookie.split(";")[0])).toBe(true);
    expect(await sessions.exchange(bootstrap.code)).toBeUndefined();
  });

  it("consumes an invalid bootstrap without creating a session", async () => {
    const directory = await mkdtemp(join(tmpdir(), "token-shuffle-admin-"));
    directories.push(directory);
    const storagePath = join(directory, "events.sqlite");
    const bootstrap = await createDashboardBootstrap(storagePath);
    const sessions = new AdminSessionManager(storagePath);

    expect(await sessions.exchange(`${bootstrap.code}-wrong`)).toBeUndefined();
    expect(await sessions.exchange(bootstrap.code)).toBeUndefined();
  });
});
