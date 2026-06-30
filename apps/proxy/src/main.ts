import { buildApp } from "./app.js";
import { loadConfig } from "./config/load-config.js";
import { SqliteEventStore } from "./storage/event-store.js";

const config = await loadConfig();
const eventStore = await SqliteEventStore.open(config.storage);
await eventStore.pruneExpired();
const app = buildApp(config, { eventSink: eventStore, logging: true });

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
