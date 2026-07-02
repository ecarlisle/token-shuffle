import { mkdtemp, rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
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

  it("opens an existing v0.4 schema without destroying its events", async () => {
    const directory = await mkdtemp(join(tmpdir(), "token-shuffle-events-"));
    directories.push(directory);
    const path = join(directory, "events.sqlite");
    const database = new DatabaseSync(path);
    database.exec(`
      CREATE TABLE observation_events (
        event_id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        event_json TEXT NOT NULL
      );
      CREATE INDEX events_request_idx ON observation_events(request_id);
      CREATE INDEX events_session_idx ON observation_events(session_id);
      CREATE INDEX events_expiry_idx ON observation_events(expires_at);
      PRAGMA user_version = 1;
    `);
    const existing = event({ eventId: "existing" });
    database
      .prepare(`
        INSERT INTO observation_events
          (event_id, request_id, session_id, event_type, occurred_at, expires_at, event_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        existing.eventId,
        existing.requestId,
        existing.session.id,
        existing.type,
        existing.timestamp,
        new Date(Date.now() + 86_400_000).toISOString(),
        JSON.stringify(existing),
      );
    database.close();

    const store = await SqliteEventStore.open({
      path,
      structuralRetentionDays: 30,
      errorRetentionDays: 14,
    });
    stores.push(store);

    expect(await store.list()).toEqual([existing]);
  });

  it("rejects a database created by a newer application", async () => {
    const directory = await mkdtemp(join(tmpdir(), "token-shuffle-events-"));
    directories.push(directory);
    const path = join(directory, "events.sqlite");
    const database = new DatabaseSync(path);
    database.exec("PRAGMA user_version = 99");
    database.close();

    await expect(
      SqliteEventStore.open({
        path,
        structuralRetentionDays: 30,
        errorRetentionDays: 14,
      }),
    ).rejects.toThrow("newer than this application");
  });

  it("stores session-scoped artifacts and retrieves exact IDs before FTS matches", async () => {
    const store = await createStore();
    await store.putArtifact({
      artifactId:
        "hmac-sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      requestId: "request-1",
      sessionId: "session-1",
      kind: "file",
      content: "src/auth/session.ts validates the bootstrap token",
      createdAt: new Date().toISOString(),
    });
    await store.putArtifact({
      artifactId:
        "hmac-sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      requestId: "request-2",
      sessionId: "session-2",
      kind: "tool-output",
      content: "bootstrap token from another session",
      createdAt: new Date().toISOString(),
    });

    const exact = await store.searchArtifacts(
      "session-1",
      "hmac-sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      3,
    );
    const lexical = await store.searchArtifacts("session-1", "bootstrap token", 3);

    expect(exact).toHaveLength(1);
    expect(exact[0]?.kind).toBe("file");
    expect(lexical.map((artifact) => artifact.artifactId)).toEqual([
      "hmac-sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ]);
    expect((await store.diagnostics()).artifactCount).toBe(2);
  });

  it("deletes artifacts with their request or session evidence", async () => {
    const store = await createStore();
    await store.putArtifact({
      artifactId:
        "hmac-sha256-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      requestId: "request-delete",
      sessionId: "session-delete",
      kind: "conversation",
      content: "private source",
      createdAt: new Date().toISOString(),
    });

    expect(await store.deleteRequest("request-delete")).toBe(0);
    expect(await store.searchArtifacts("session-delete", "private", 3)).toEqual([]);
  });

  it("keeps identical content isolated when session-scoped IDs differ", async () => {
    const store = await createStore();
    const content = "same readable source";
    await store.putArtifact({
      artifactId:
        "hmac-sha256-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      requestId: "request-a",
      sessionId: "session-a",
      kind: "conversation",
      content,
      createdAt: new Date().toISOString(),
    });
    await store.putArtifact({
      artifactId:
        "hmac-sha256-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      requestId: "request-b",
      sessionId: "session-b",
      kind: "conversation",
      content,
      createdAt: new Date().toISOString(),
    });

    expect(await store.searchArtifacts("session-a", "readable", 3)).toHaveLength(1);
    expect(await store.searchArtifacts("session-b", "readable", 3)).toHaveLength(1);
    expect((await store.diagnostics()).artifactCount).toBe(2);
  });
});
