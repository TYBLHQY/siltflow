/**
 * Server-specific database migrations.
 *
 * Creates the two server-only tables (devices, sync_tombstones).
 * The shared 7 tables are handled by @siltflow/shared-db's initSchema().
 */

import type { SqlExecutor } from "@siltflow/shared-db/db";

const SERVER_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_seen_at TEXT
  );`,

  `CREATE TABLE IF NOT EXISTS sync_tombstones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    deleted_at TEXT NOT NULL
  );`,

  `CREATE INDEX IF NOT EXISTS idx_tombstones_deleted_at
    ON sync_tombstones(deleted_at);`,
];

export function initServerSchema(executor: SqlExecutor): void {
  for (const stmt of SERVER_TABLES_SQL) {
    executor.exec(stmt);
  }
}
