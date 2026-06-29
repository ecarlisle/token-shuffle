import Fastify, { type FastifyInstance } from "fastify";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: false,
  });

  app.get("/_token-shuffle/status", async () => ({
    mode: "foundation",
    name: "token-shuffle",
    ready: true,
    version: "0.0.0",
  }));

  return app;
}
