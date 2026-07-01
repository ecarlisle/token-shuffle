#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";

import { request } from "undici";

import { createDashboardBootstrap } from "./auth/admin-session.js";
import { extractGlobalOptions, parseCliCommand } from "./cli-command.js";
import {
  ConfigError,
  defaultConfigPath,
  loadConfig,
} from "./config/load-config.js";
import type { RuntimeConfig } from "./config/schema.js";
import { SqliteEventStore } from "./storage/event-store.js";

const HELP = `Token Shuffle

Usage:
  token-shuffle [--config PATH] start [--foreground]
  token-shuffle stop
  token-shuffle status
  token-shuffle config path
  token-shuffle config validate
  token-shuffle doctor
  token-shuffle open [--no-browser]
`;

let configPathOverride: string | undefined;

try {
  const globalOptions = extractGlobalOptions(process.argv.slice(2));
  configPathOverride = globalOptions.configPath;
  const command = parseCliCommand(globalOptions.commandArgs);
  if (command.name === "help") write(HELP);
  else if (command.name === "config-path") write(`${activeConfigPath()}\n`);
  else if (command.name === "config-validate") await validateConfig();
  else if (command.name === "start") await start(command.foreground);
  else if (command.name === "stop") await stop();
  else if (command.name === "status") await status();
  else if (command.name === "open") await openDashboard(command.noBrowser);
  else await doctor();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Token Shuffle: ${message}\n`);
  process.exitCode = error instanceof ConfigError ? 2 : 1;
}

function write(value: string): void {
  process.stdout.write(value);
}

function activeConfigPath(): string {
  return configPathOverride ?? process.env.TOKEN_SHUFFLE_CONFIG ?? defaultConfigPath();
}

async function validateConfig(): Promise<void> {
  const config = await loadConfig(activeConfigPath());
  write(
    `Configuration is valid: ${config.server.host}:${config.server.port}, ` +
      `${config.upstream.baseUrl.origin}, mode=${config.mode}\n`,
  );
}

async function start(foreground: boolean): Promise<void> {
  const config = await loadConfig(activeConfigPath());
  const pidFile = pidPath(config);
  const existing = await readPid(pidFile);
  if (existing !== undefined && isRunning(existing)) {
    throw new Error(`Token Shuffle is already running with PID ${existing}.`);
  }
  const child = spawn(process.execPath, [new URL("./main.js", import.meta.url).pathname], {
    detached: !foreground,
    env: { ...process.env, TOKEN_SHUFFLE_CONFIG: activeConfigPath() },
    stdio: foreground ? "inherit" : "ignore",
  });
  if (child.pid === undefined) throw new Error("Unable to start the proxy process.");
  await mkdir(dirname(pidFile), { recursive: true });
  await writeFile(pidFile, `${child.pid}\n`, { mode: 0o600 });
  if (foreground) {
    const exitCode = await new Promise<number>((resolve) => {
      child.once("exit", (code) => resolve(code ?? 1));
    });
    await rm(pidFile, { force: true });
    process.exitCode = exitCode;
  } else {
    child.unref();
    try {
      await waitUntilReady(config, child.pid);
    } catch (error) {
      if (isRunning(child.pid)) process.kill(child.pid, "SIGTERM");
      await rm(pidFile, { force: true });
      throw error;
    }
    write(`Token Shuffle started with PID ${child.pid}.\n`);
  }
}

async function stop(): Promise<void> {
  const config = await loadConfig(activeConfigPath());
  const pidFile = pidPath(config);
  const pid = await readPid(pidFile);
  if (pid === undefined || !isRunning(pid)) {
    await rm(pidFile, { force: true });
    throw new Error("Token Shuffle is not running.");
  }
  process.kill(pid, "SIGTERM");
  await rm(pidFile, { force: true });
  write(`Token Shuffle stop requested for PID ${pid}.\n`);
}

async function status(): Promise<void> {
  const config = await loadConfig(activeConfigPath());
  const response = await request(
    `http://${config.server.host}:${config.server.port}/_token-shuffle/status`,
    {
      headers: { authorization: `Bearer ${config.auth.accessToken}` },
      headersTimeout: 5_000,
      bodyTimeout: 5_000,
    },
  );
  const body = await response.body.text();
  if (response.statusCode !== 200) throw new Error(`Status failed with HTTP ${response.statusCode}.`);
  write(`${body}\n`);
}

async function openDashboard(noBrowser: boolean): Promise<void> {
  const config = await loadConfig(activeConfigPath());
  const statusResponse = await request(
    `http://${config.server.host}:${config.server.port}/_token-shuffle/status`,
    {
      headers: { authorization: `Bearer ${config.auth.accessToken}` },
      headersTimeout: 5_000,
      bodyTimeout: 5_000,
    },
  );
  const statusBody = await statusResponse.body.text();
  if (statusResponse.statusCode !== 200) {
    throw new Error(`Dashboard status failed with HTTP ${statusResponse.statusCode}.`);
  }
  const statusValue = JSON.parse(statusBody) as { readonly phase?: unknown };
  if (statusValue.phase !== "v0.2") {
    throw new Error("Restart Token Shuffle with the v0.2 build before opening.");
  }
  const bootstrap = await createDashboardBootstrap(config.storage.path);
  const url = `http://${config.server.host}:${config.server.port}/#bootstrap=${bootstrap.code}`;
  write(`Dashboard bootstrap expires at ${bootstrap.expiresAt}.\n${url}\n`);
  if (!noBrowser) {
    const launcher =
      process.platform === "darwin"
        ? { command: "open", args: [url] }
        : process.platform === "win32"
          ? { command: "cmd", args: ["/c", "start", "", url] }
          : { command: "xdg-open", args: [url] };
    const child = spawn(launcher.command, launcher.args, {
      detached: true,
      stdio: "ignore",
    });
    child.once("error", () => {
      write("The browser could not be opened automatically; use the URL above.\n");
    });
    child.unref();
  }
}

async function doctor(): Promise<void> {
  const config = await loadConfig(activeConfigPath());
  await assertPortAvailable(config);
  const store = await SqliteEventStore.open(config.storage);
  try {
    const diagnostics = await store.diagnostics();
    const upstream = new URL("models", trailingSlash(config.upstream.baseUrl));
    const response = await request(upstream, {
      headers: { authorization: `Bearer ${config.upstream.apiKey}` },
      headersTimeout: config.limits.upstreamConnectTimeoutMs,
      bodyTimeout: 10_000,
    });
    await response.body.dump();
    if (response.statusCode < 200 || response.statusCode >= 400) {
      throw new Error(`Upstream diagnostic failed with HTTP ${response.statusCode}.`);
    }
    write(
      `Doctor passed: port available, SQLite ${diagnostics.sqliteVersion}, ` +
        `upstream HTTP ${response.statusCode}.\n`,
    );
  } finally {
    await store.close();
  }
}

async function assertPortAvailable(config: RuntimeConfig): Promise<void> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.server.port, config.server.host, resolve);
  });
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}

function trailingSlash(url: URL): URL {
  const result = new URL(url);
  if (!result.pathname.endsWith("/")) result.pathname += "/";
  return result;
}

function pidPath(config: RuntimeConfig): string {
  return join(dirname(config.storage.path), "token-shuffle.pid");
}

async function readPid(path: string): Promise<number | undefined> {
  try {
    const value = Number.parseInt((await readFile(path, "utf8")).trim(), 10);
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitUntilReady(config: RuntimeConfig, pid: number): Promise<void> {
  const url = `http://${config.server.host}:${config.server.port}/_token-shuffle/status`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!isRunning(pid)) throw new Error("Proxy process exited during startup.");
    try {
      const response = await request(url, {
        headers: { authorization: `Bearer ${config.auth.accessToken}` },
        headersTimeout: 250,
        bodyTimeout: 250,
      });
      await response.body.dump();
      if (response.statusCode === 200) return;
    } catch {
      // The listener may not be ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Proxy did not become ready within two seconds.");
}
