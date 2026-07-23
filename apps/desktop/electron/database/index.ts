import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { SCHEMA_VERSION, AI_DATA_VERSION } from "@siltflow/shared-db/types";
import { initSchema } from "@siltflow/shared-db/migrations";
import { createBetterSqlite3Executor } from "./better-sqlite3-adapter";
import { initChangelogTable } from "../sync/changelog";
import fs from "node:fs";
import path from "node:path";

// ── Re-export constants from shared-db for consumers ─────────────────
export { SCHEMA_VERSION, AI_DATA_VERSION };

// ── Schema version ───────────────────────────────────────────────────
// Bump in packages/shared-db/src/types.ts

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlite: Database.Database | null = null;

export function initDatabase(vaultPath: string) {
  const dbDir = path.join(vaultPath, ".siltflow");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  sqlite = new Database(path.join(dbDir, "data.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  db = drizzle(sqlite, { schema });

  // Check / migrate schema version using shared migration system
  const version = sqlite.pragma("user_version", { simple: true }) as number;
  const executor = createBetterSqlite3Executor(sqlite);

  // initSchema handles: create tables (idempotent) + version-gated migrations
  initSchema(executor, version);

  // Sync changelog — tracks deletions for push
  initChangelogTable(sqlite);

  // Update schema version after migration
  if (version < SCHEMA_VERSION) {
    sqlite.pragma(`user_version = ${SCHEMA_VERSION}`);
  }

  return db;
}

export function getDb() {
  return db;
}

export function getSqlite() {
  return sqlite;
}

export { schema };
