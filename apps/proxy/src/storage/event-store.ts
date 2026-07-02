import { Worker } from "node:worker_threads";
import { readFile } from "node:fs/promises";

import type { EventSink, ObservationEvent } from "../observation/events.js";

interface WorkerReply {
  readonly id: number;
  readonly result?: unknown;
  readonly error?: string;
}

export interface ContextArtifact {
  readonly artifactId: string;
  readonly requestId: string;
  readonly sessionId: string;
  readonly kind: "conversation" | "tool-output" | "file";
  readonly content: string;
  readonly createdAt: string;
}

export interface ArtifactMatch {
  readonly artifactId: string;
  readonly kind: ContextArtifact["kind"];
  readonly content: string;
  readonly contentBytes: number;
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
    artifactRetentionDays: number,
    migrations: readonly string[],
  ) {
    this.#worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: {
        path,
        structuralRetentionDays,
        errorRetentionDays,
        artifactRetentionDays,
        migrations,
      },
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
    readonly artifactRetentionDays?: number;
  }): Promise<SqliteEventStore> {
    const migrations = await loadMigrations();
    const store = new SqliteEventStore(
      options.path,
      options.structuralRetentionDays,
      options.errorRetentionDays,
      options.artifactRetentionDays ?? 7,
      migrations,
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

  public async putArtifact(artifact: ContextArtifact): Promise<void> {
    await this.#request("putArtifact", artifact);
  }

  public async searchArtifacts(
    sessionId: string,
    query: string,
    limit: number,
  ): Promise<ArtifactMatch[]> {
    return (await this.#request("searchArtifacts", {
      sessionId,
      query,
      limit,
    })) as ArtifactMatch[];
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
    readonly artifactCount: number;
  }> {
    return (await this.#request("diagnostics")) as {
      sqliteVersion: string;
      eventCount: number;
      artifactCount: number;
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

async function loadMigrations(): Promise<readonly string[]> {
  return [
    await readFile(
      new URL("./migrations/0001-observation-events.sql", import.meta.url),
      "utf8",
    ),
    await readFile(
      new URL("./migrations/0002-context-artifacts.sql", import.meta.url),
      "utf8",
    ),
  ];
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
  const latestSchemaVersion = workerData.migrations.length;
  if (schemaVersion > latestSchemaVersion) {
    throw new Error("Event database schema is newer than this application.");
  }
  for (let index = schemaVersion; index < latestSchemaVersion; index += 1) {
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(workerData.migrations[index]);
      database.exec("PRAGMA user_version = " + (index + 1));
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
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
    } else if (type === "putArtifact") {
      const expiresAt = new Date(
        Date.parse(payload.createdAt) + workerData.artifactRetentionDays * 86400000
      ).toISOString();
      database.prepare(\`
        INSERT INTO context_artifacts
          (artifact_id, request_id, session_id, artifact_kind, created_at, expires_at,
           content, content_bytes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(artifact_id) DO UPDATE SET
          request_id = excluded.request_id,
          session_id = excluded.session_id,
          artifact_kind = excluded.artifact_kind,
          created_at = excluded.created_at,
          expires_at = excluded.expires_at,
          content = excluded.content,
          content_bytes = excluded.content_bytes
      \`).run(
        payload.artifactId,
        payload.requestId,
        payload.sessionId,
        payload.kind,
        payload.createdAt,
        expiresAt,
        payload.content,
        Buffer.byteLength(payload.content)
      );
    } else if (type === "searchArtifacts") {
      const exact = database.prepare(\`
        SELECT artifact_id AS artifactId, artifact_kind AS kind, content,
               content_bytes AS contentBytes
        FROM context_artifacts
        WHERE session_id = ? AND artifact_id = ? AND expires_at > ?
        LIMIT 1
      \`).all(payload.sessionId, payload.query, new Date().toISOString());
      if (exact.length > 0) {
        result = exact;
      } else {
        const tokens = String(payload.query).match(/[\\p{L}\\p{N}_./-]+/gu) || [];
        const match = [...new Set(tokens)]
          .slice(0, 12)
          .map(token => '"' + token.replaceAll('"', '""') + '"')
          .join(" OR ");
        result = match.length === 0 ? [] : database.prepare(\`
          SELECT a.artifact_id AS artifactId, a.artifact_kind AS kind, a.content,
                 a.content_bytes AS contentBytes
          FROM context_artifacts_fts
          JOIN context_artifacts a ON a.rowid = context_artifacts_fts.rowid
          WHERE context_artifacts_fts MATCH ?
            AND a.session_id = ?
            AND a.expires_at > ?
          ORDER BY bm25(context_artifacts_fts), a.created_at DESC
          LIMIT ?
        \`).all(match, payload.sessionId, new Date().toISOString(), payload.limit);
      }
    } else if (type === "deleteRequest") {
      const eventChanges = Number(database.prepare(
        "DELETE FROM observation_events WHERE request_id = ?"
      ).run(payload).changes);
      const artifactChanges = Number(database.prepare(
        "DELETE FROM context_artifacts WHERE request_id = ?"
      ).run(payload).changes);
      result = eventChanges;
    } else if (type === "deleteSession") {
      const eventChanges = Number(database.prepare(
        "DELETE FROM observation_events WHERE session_id = ?"
      ).run(payload).changes);
      const artifactChanges = Number(database.prepare(
        "DELETE FROM context_artifacts WHERE session_id = ?"
      ).run(payload).changes);
      result = eventChanges;
    } else if (type === "deleteAll") {
      const eventChanges = Number(
        database.prepare("DELETE FROM observation_events").run().changes
      );
      const artifactChanges = Number(
        database.prepare("DELETE FROM context_artifacts").run().changes
      );
      result = eventChanges;
    } else if (type === "prune") {
      const eventChanges = Number(database.prepare(
        "DELETE FROM observation_events WHERE expires_at <= ?"
      ).run(payload).changes);
      const artifactChanges = Number(database.prepare(
        "DELETE FROM context_artifacts WHERE expires_at <= ?"
      ).run(payload).changes);
      result = eventChanges + artifactChanges;
    } else if (type === "diagnostics") {
      result = {
        sqliteVersion: database.prepare("SELECT sqlite_version() AS version").get().version,
        eventCount: Number(database.prepare(
          "SELECT COUNT(*) AS count FROM observation_events"
        ).get().count),
        artifactCount: Number(database.prepare(
          "SELECT COUNT(*) AS count FROM context_artifacts"
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
