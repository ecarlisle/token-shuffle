import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 3211,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3210",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (request) => {
            request.setHeader("origin", "http://127.0.0.1:3210");
          });
        },
      },
    },
  },
  build: {
    target: "es2023",
  },
  test: {
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
