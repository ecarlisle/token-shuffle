import { buildApp } from "./app.js";
import { loadConfig } from "./config/load-config.js";

const config = await loadConfig();
const app = buildApp(config);

try {
  await app.listen(config.server);
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
