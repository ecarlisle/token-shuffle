import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildApp } from "./app.js";
import { loadConfig } from "./config/load-config.js";
import { SqliteEventStore } from "./storage/event-store.js";

const config = await loadConfig();
const eventStore = await SqliteEventStore.open(config.storage);
await eventStore.pruneExpired();
const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));
const app = buildApp(config, {
  eventSink: eventStore,
  eventReader: eventStore,
  logging: true,
  webRoot: existsSync(webRoot) ? webRoot : undefined,
});

const stop = async (): Promise<void> => {
  await app.close();
};
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());

try {
  await app.listen(config.server);
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
