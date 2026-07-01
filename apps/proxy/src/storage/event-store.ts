import { Worker } from "node:worker_threads";

import type { EventSink, ObservationEvent } from "../observation/events.js";

interface WorkerReply {
  readonly id: number;
  readonly result?: unknown;
  readonly error?: string;
}

export class SqliteEventStore implements EventSink {
  readonly #worker: Worker;
  readonly #pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void; bytes: number }
  >();
  #nextId = 1;
  #pendingBytes = 0;
  #closed = false;

  private constructor(
    path: string,
    structuralRetentionDays: number,
    errorRetentionDays: number,
  ) {
    this.#worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { path, structuralRetentionDays, errorRetentionDays },
    });
    this.#worker.on("message", (reply: WorkerReply) => this.#receive(reply));
    this.#worker.on("error", (error) => this.#rejectAll(error));
    this.#worker.on("exit", (code) => {
      if (code !== 0 && !this.#closed) {
        this.#rejectAll(new Error(`Event-store worker exited with code ${code}.`));
      }
    });
  }

  public static async open(options: {
    readonly path: string;
    readonly structuralRetentionDays: number;
    readonly errorRetentionDays: number;
  }): Promise<SqliteEventStore> {
    const store = new SqliteEventStore(
      options.path,
      options.structuralRetentionDays,
      options.errorRetentionDays,
    );
    await store.#request("initialize");
    return store;
  }

  public async append(event: ObservationEvent): Promise<void> {
    await this.#request("append", event);
  }

  public async list(): Promise<ObservationEvent[]> {
    return (await this.#request("list")) as ObservationEvent[];
  }

  public async deleteRequest(requestId: string): Promise<number> {
    return (await this.#request("deleteRequest", requestId)) as number;
  }

  public async deleteSession(sessionId: string): Promise<number> {
    return (await this.#request("deleteSession", sessionId)) as number;
  }

  public async deleteAll(): Promise<number> {
    return (await this.#request("deleteAll")) as number;
  }

  public async pruneExpired(now = new Date()): Promise<number> {
    return (await this.#request("prune", now.toISOString())) as number;
  }

  public async diagnostics(): Promise<{
    readonly sqliteVersion: string;
    readonly eventCount: number;
  }> {
    return (await this.#request("diagnostics")) as {
      sqliteVersion: string;
      eventCount: number;
    };
  }

  public async close(): Promise<void> {
    if (this.#closed) return;
    await this.#request("close");
    this.#closed = true;
  }

  async #request(type: string, payload?: unknown): Promise<unknown> {
    if (this.#closed) throw new Error("Event store is closed.");
    const encodedBytes = Buffer.byteLength(JSON.stringify(payload ?? null));
    if (this.#pending.size >= 1_024 || this.#pendingBytes + encodedBytes > 2 * 1024 * 1024) {
      throw new Error("Event persistence queue is full.");
    }
    const id = this.#nextId++;
    this.#pendingBytes += encodedBytes;
    const promise = new Promise<unknown>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, bytes: encodedBytes });
    });
    this.#worker.postMessage({ id, type, payload });
    return promise;
  }

  #receive(reply: WorkerReply): void {
    const pending = this.#pending.get(reply.id);
    if (pending === undefined) return;
    this.#pending.delete(reply.id);
    this.#pendingBytes -= pending.bytes;
    if (reply.error !== undefined) pending.reject(new Error(reply.error));
    else pending.resolve(reply.result);
  }

  #rejectAll(error: Error): void {
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
    this.#pendingBytes = 0;
  }
}

const WORKER_SOURCE = `
const { mkdirSync } = require("node:fs");
const { dirname } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { parentPort, workerData } = require("node:worker_threads");

let database;
function initialize() {
  if (workerData.path !== ":memory:") mkdirSync(dirname(workerData.path), { recursive: true });
  database = new DatabaseSync(workerData.path);
  database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const sqliteVersion = database.prepare("SELECT sqlite_version() AS version").get().version;
  const versionParts = sqliteVersion.split(".").map(Number);
  if (
    versionParts[0] < 3 ||
    (versionParts[0] === 3 && versionParts[1] < 51) ||
    (versionParts[0] === 3 && versionParts[1] === 51 && versionParts[2] < 3)
  ) {
    throw new Error("SQLite 3.51.3 or newer is required for safe WAL operation.");
  }
  if (workerData.path !== ":memory:") {
    database.exec("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 1000;");
  }
  const schemaVersion = Number(database.prepare("PRAGMA user_version").get().user_version);
  if (schemaVersion > 1) throw new Error("Event database schema is newer than this application.");
  database.exec(\`
    CREATE TABLE IF NOT EXISTS observation_events (
      event_id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      event_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_request_idx ON observation_events(request_id);
    CREATE INDEX IF NOT EXISTS events_session_idx ON observation_events(session_id);
    CREATE INDEX IF NOT EXISTS events_expiry_idx ON observation_events(expires_at);
    PRAGMA user_version = 1;
  \`);
  const integrity = database.prepare("PRAGMA quick_check").get().quick_check;
  if (integrity !== "ok") throw new Error("Event database integrity check failed.");
}
function reply(id, result, error) { parentPort.postMessage({ id, result, error }); }
parentPort.on("message", ({ id, type, payload }) => {
  try {
    let result;
    if (type === "initialize") initialize();
    else if (type === "append") {
      const days = payload.retentionClass === "redacted-error"
        ? workerData.errorRetentionDays : workerData.structuralRetentionDays;
      const expiresAt = new Date(Date.parse(payload.timestamp) + days * 86400000).toISOString();
      database.prepare(\`
        INSERT INTO observation_events
          (event_id, request_id, session_id, event_type, occurred_at, expires_at, event_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      \`).run(payload.eventId, payload.requestId, payload.session.id, payload.type,
        payload.timestamp, expiresAt, JSON.stringify(payload));
    } else if (type === "list") {
      result = database.prepare(
        "SELECT event_json FROM observation_events ORDER BY occurred_at, rowid"
      ).all().map(row => JSON.parse(row.event_json));
    } else if (type === "deleteRequest") {
      result = Number(database.prepare(
        "DELETE FROM observation_events WHERE request_id = ?"
      ).run(payload).changes);
    } else if (type === "deleteSession") {
      result = Number(database.prepare(
        "DELETE FROM observation_events WHERE session_id = ?"
      ).run(payload).changes);
    } else if (type === "deleteAll") {
      result = Number(database.prepare("DELETE FROM observation_events").run().changes);
    } else if (type === "prune") {
      result = Number(database.prepare(
        "DELETE FROM observation_events WHERE expires_at <= ?"
      ).run(payload).changes);
    } else if (type === "diagnostics") {
      result = {
        sqliteVersion: database.prepare("SELECT sqlite_version() AS version").get().version,
        eventCount: Number(database.prepare(
          "SELECT COUNT(*) AS count FROM observation_events"
        ).get().count)
      };
    } else if (type === "close") {
      database.close();
      reply(id);
      parentPort.close();
      return;
    } else throw new Error("Unknown event-store operation.");
    reply(id, result);
  } catch (error) {
    reply(id, undefined, error instanceof Error ? error.message : String(error));
  }
});
`;
