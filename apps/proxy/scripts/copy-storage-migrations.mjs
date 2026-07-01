import { cp, mkdir } from "node:fs/promises";

await mkdir(new URL("../dist/storage/migrations/", import.meta.url), {
  recursive: true,
});
await cp(
  new URL("../src/storage/migrations/", import.meta.url),
  new URL("../dist/storage/migrations/", import.meta.url),
  { recursive: true },
);
