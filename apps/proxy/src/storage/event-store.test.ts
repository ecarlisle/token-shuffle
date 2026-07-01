import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  EVENT_SCHEMA_VERSION,
  type ObservationEvent,
} from "../observation/events.js";
import { SqliteEventStore } from "./event-store.js";

const stores: SqliteEventStore[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function event(overrides: Partial<ObservationEvent> = {}): ObservationEvent {
  return {
    schemaVersion: EVENT_SCHEMA_VERSION,
    eventId: crypto.randomUUID(),
    type: "request.measured",
    timestamp: new Date().toISOString(),
    requestId: "request-1",
    attemptId: "attempt-1",
    session: {
      id: "session-1",
      association: "explicit",
      method: "x-token-shuffle-session-id",
    },
    protocol: "openai-chat-completions",
    provider: "openai-compatible",
    model: "synthetic-model",
    data: { inputTokens: 10, provenance: "estimate" },
    retentionClass: "structural",
    ...overrides,
  };
}

async function createStore(): Promise<SqliteEventStore> {
  const directory = await mkdtemp(join(tmpdir(), "token-shuffle-events-"));
  directories.push(directory);
  const store = await SqliteEventStore.open({
    path: join(directory, "events.sqlite"),
    structuralRetentionDays: 30,
    errorRetentionDays: 14,
  });
  stores.push(store);
  return store;
}

describe("SqliteEventStore", () => {
  it("persists versioned structural events without readable request content", async () => {
    const store = await createStore();
    await store.append(event());

    const events = await store.list();
    const diagnostics = await store.diagnostics();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      schemaVersion: 1,
      requestId: "request-1",
      data: { provenance: "estimate" },
    });
    expect(JSON.stringify(events)).not.toContain("secret prompt");
    expect(diagnostics.eventCount).toBe(1);
    expect(diagnostics.sqliteVersion).toMatch(/^3\./);
  });

  it("prunes expired events and supports request/session deletion", async () => {
    const store = await createStore();
    await store.append(
      event({
        eventId: "expired",
        timestamp: new Date(Date.now() - 31 * 86_400_000).toISOString(),
      }),
    );
    await store.append(event({ eventId: "request-delete", requestId: "request-delete" }));
    await store.append(
      event({
        eventId: "session-delete",
        requestId: "request-2",
        session: {
          id: "session-delete",
          association: "explicit",
          method: "x-token-shuffle-session-id",
        },
      }),
    );

    expect(await store.pruneExpired()).toBe(1);
    expect(await store.deleteRequest("request-delete")).toBe(1);
    expect(await store.deleteSession("session-delete")).toBe(1);
    expect(await store.list()).toEqual([]);
  });
});
