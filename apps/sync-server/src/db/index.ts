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
import { initServerSchema } from "./migrations";
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

  // Server-only tables
  initServerSchema(executor);

  // Update schema version
  if (version < SCHEMA_VERSION) {
    _sqlite.pragma(`user_version = ${SCHEMA_VERSION}`);
  }

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

// ── SqlExecutor adapter (TODO: move to shared-db, see plan step 27) ──

import type { SqlExecutor, SqlRunResult } from "@siltflow/shared-db/db";

function createSqlExecutor(database: Database.Database): SqlExecutor {
  return {
    run(sql: string, ...params: unknown[]): SqlRunResult {
      const result = database.prepare(sql).run(...params);
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowid };
    },
    all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
      return database.prepare(sql).all(...params) as T[];
    },
    get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
      return database.prepare(sql).get(...params) as T | undefined;
    },
    exec(sql: string): void {
      database.exec(sql);
    },
    transaction<T>(fn: (executor: SqlExecutor) => T): T {
      const self = this;
      const txFn = database.transaction(() => fn(self));
      return txFn();
    },
  };
}
