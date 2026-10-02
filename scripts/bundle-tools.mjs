/**
 * Bundles the maintenance scripts (migrate, seed, create-admin, monitor) into
 * plain Node files under dist/tools so production containers can run them
 * without TypeScript tooling:  node dist/tools/migrate.cjs
 */
import { build } from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("dist/tools", { recursive: true });
await build({
  entryPoints: {
    migrate: "src/db/migrate.ts",
    seed: "src/db/seed.ts",
    "create-admin": "src/scripts/create-admin.ts",
    monitor: "src/scripts/monitor.ts",
  },
  outdir: "dist/tools",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: false,
  logLevel: "info",
  // Native / heavy packages stay external and are resolved from node_modules at runtime.
  // Playwright is only loaded on demand (monitor "render" mode) and must never be bundled.
  external: ["@libsql/client", "libsql", "react", "next", "server-only", "playwright", "playwright-core", "chromium-bidi", "chromium-bidi/*"],
});
