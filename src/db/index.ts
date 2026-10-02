import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";
import fs from "node:fs";
import path from "node:path";

/**
 * Load a local .env file for CLI scripts (Next.js loads it for the app itself).
 * Existing environment variables always win; missing files are ignored.
 */
(function loadDotEnv() {
  if (process.env.__BT_ENV_LOADED) return;
  process.env.__BT_ENV_LOADED = "1";
  for (const name of [".env.local", ".env"]) {
    const file = path.resolve(process.cwd(), name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
      if (!m) continue;
      let value = (m[2] ?? "").trim();
      if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
      else value = value.replace(/\s+#.*$/, "");
      if (process.env[m[1]] === undefined) process.env[m[1]] = value;
    }
  }
})();

/**
 * Single shared database connection.
 *
 * DATABASE_URL examples:
 *   file:./data/bettertier.db            (local SQLite file – default)
 *   libsql://your-db.turso.io            (Turso, with DATABASE_AUTH_TOKEN)
 */
const url = process.env.DATABASE_URL ?? "file:./data/bettertier.db";

// Make sure the directory for a local file database exists.
if (url.startsWith("file:")) {
  const filePath = url.slice("file:".length);
  const dir = path.dirname(path.resolve(filePath));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const globalForDb = globalThis as unknown as { __btClient?: Client };

export const client: Client =
  globalForDb.__btClient ??
  createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__btClient = client;

// SQLite does not enforce foreign keys unless asked. Cascading deletes depend on this.
if (url.startsWith("file:")) {
  void client.execute("PRAGMA foreign_keys = ON");
  void client.execute("PRAGMA journal_mode = WAL");
}

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
