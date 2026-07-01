import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ADMIN_COOKIE = "token_shuffle_admin";
const BOOTSTRAP_LIFETIME_MS = 2 * 60_000;
const SESSION_LIFETIME_MS = 8 * 60 * 60_000;

interface BootstrapRecord {
  readonly version: 1;
  readonly codeHash: string;
  readonly expiresAt: string;
}

export function dashboardBootstrapPath(storagePath: string): string {
  return join(dirname(storagePath), "dashboard-bootstrap.json");
}

export async function createDashboardBootstrap(
  storagePath: string,
): Promise<{ readonly code: string; readonly expiresAt: string }> {
  const code = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + BOOTSTRAP_LIFETIME_MS).toISOString();
  const path = dashboardBootstrapPath(storagePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    JSON.stringify({
      version: 1,
      codeHash: digest(code).toString("hex"),
      expiresAt,
    } satisfies BootstrapRecord),
    { mode: 0o600 },
  );
  return { code, expiresAt };
}

export class AdminSessionManager {
  readonly #sessions = new Map<string, number>();

  public constructor(private readonly storagePath: string) {}

  public async exchange(code: string): Promise<string | undefined> {
    const path = dashboardBootstrapPath(this.storagePath);
    let record: BootstrapRecord;
    try {
      record = JSON.parse(await readFile(path, "utf8")) as BootstrapRecord;
    } catch {
      return undefined;
    }

    await rm(path, { force: true });
    if (
      record.version !== 1 ||
      !Number.isFinite(Date.parse(record.expiresAt)) ||
      Date.parse(record.expiresAt) <= Date.now()
    ) {
      return undefined;
    }

    const suppliedHash = digest(code);
    const expectedHash = Buffer.from(record.codeHash, "hex");
    if (
      expectedHash.byteLength !== suppliedHash.byteLength ||
      !timingSafeEqual(expectedHash, suppliedHash)
    ) {
      return undefined;
    }

    const token = randomBytes(32).toString("base64url");
    this.#sessions.set(digest(token).toString("hex"), Date.now() + SESSION_LIFETIME_MS);
    this.#prune();
    return token;
  }

  public authenticate(cookieHeader: string | undefined): boolean {
    const token = readCookie(cookieHeader, ADMIN_COOKIE);
    if (token === undefined) return false;
    const key = digest(token).toString("hex");
    const expiresAt = this.#sessions.get(key);
    if (expiresAt === undefined || expiresAt <= Date.now()) {
      this.#sessions.delete(key);
      return false;
    }
    return true;
  }

  public revoke(cookieHeader: string | undefined): void {
    const token = readCookie(cookieHeader, ADMIN_COOKIE);
    if (token !== undefined) this.#sessions.delete(digest(token).toString("hex"));
  }

  public sessionCookie(token: string): string {
    return `${ADMIN_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${
      SESSION_LIFETIME_MS / 1000
    }`;
  }

  public expiredCookie(): string {
    return `${ADMIN_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
  }

  #prune(): void {
    const now = Date.now();
    for (const [key, expiresAt] of this.#sessions) {
      if (expiresAt <= now) this.#sessions.delete(key);
    }
  }
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) return undefined;
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() === name) {
      const value = pair.slice(separator + 1).trim();
      return value.length === 0 ? undefined : value;
    }
  }
  return undefined;
}
