/**
 * Database initialisation — opens SQLite, applies schemas, provides accessors.
 *
 * Uses the same pattern as desktop's electron/database/index.ts:
 *   1. Open better-sqlite3 with WAL + foreign_keys
 *   2. Wrap with Drizzle ORM
 *   3. Run shared + server migrations
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { schema } from "./schema";
import { initSchema } from "@siltflow/shared-db/migrations";
import { SCHEMA_VERSION } from "@siltflow/shared-db/types";
import { initServerSchema, SV_SCHEMA_VERSION } from "./migrations";
import type { ServerConfig } from "../config";
import fs from "node:fs";
import path from "node:path";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

export function initDatabase(config: ServerConfig) {
  if (_db) return _db;

  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }

  const dbPath = path.join(config.dataDir, "data.db");
  _sqlite = new Database(dbPath);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");

  _db = drizzle(_sqlite, { schema });

  // Shared-db: create 7 tables + version-gated migrations
  const version = _sqlite.pragma("user_version", { simple: true }) as number;
  const executor = createSqlExecutor(_sqlite);
  initSchema(executor, version);

  // Update shared schema version
  if (version < SCHEMA_VERSION) {
    _sqlite.pragma(`user_version = ${SCHEMA_VERSION}`);
  }

  // Server-only tables: read stored version, run migrations, persist
  const svRow = executor.get<{ value: string }>(
    "SELECT value FROM server_settings WHERE key = 'schema_version'",
  );
  const svVersion = svRow ? parseInt(svRow.value, 10) : 0;
  if (svVersion < SV_SCHEMA_VERSION) {
    console.log(
      `[sync-server] Server schema migration: v${svVersion} → v${SV_SCHEMA_VERSION}`,
    );
  }
  initServerSchema(executor, svVersion);

  return _db;
}

/** Returns the Drizzle ORM instance (typed with full server schema). */
export function getDb() {
  return _db;
}

/** Returns the raw better-sqlite3 connection. */
export function getSqlite(): Database.Database | null {
  return _sqlite;
}

import { createBetterSqlite3Executor } from "@siltflow/shared-db/adapters/better-sqlite3";

// ── Helpers ──────────────────────────────────────────────────────────

/** Wraps better-sqlite3 Database into the shared SqlExecutor interface. */
function createSqlExecutor(database: Database.Database) {
  return createBetterSqlite3Executor(database);
}
