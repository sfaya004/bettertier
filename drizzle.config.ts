import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  ...(process.env.DATABASE_URL?.startsWith("libsql://")
    ? {
        driver: "turso" as const,
        dbCredentials: {
          url: process.env.DATABASE_URL,
          authToken: process.env.DATABASE_AUTH_TOKEN,
        },
      }
    : {
        dbCredentials: { url: process.env.DATABASE_URL ?? "file:./data/bettertier.db" },
      }),
});
