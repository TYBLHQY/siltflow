/**
 * Server-specific database migrations.
 *
 * Creates server-only tables (devices, sync_tombstones, server_settings)
 * and handles incremental schema changes via ALTER TABLE.
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

  `CREATE TABLE IF NOT EXISTS sync_tombstone_acks (
    tombstone_id INTEGER NOT NULL REFERENCES sync_tombstones(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    acked_at TEXT NOT NULL,
    PRIMARY KEY (tombstone_id, device_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_tombstones_deleted_at
    ON sync_tombstones(deleted_at);`,

  `CREATE INDEX IF NOT EXISTS idx_tombstones_deleted_at
    ON sync_tombstones(deleted_at);`,

  `CREATE TABLE IF NOT EXISTS server_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

];

const MIGRATIONS_SQL = [
  // Add last_sync_at column to devices (for tracking sync timing)
  `ALTER TABLE devices ADD COLUMN last_sync_at TEXT;`,
];

export function initServerSchema(executor: SqlExecutor): void {
  for (const stmt of SERVER_TABLES_SQL) {
    executor.exec(stmt);
  }

  // Run incremental migrations (safe to fail if column already exists)
  for (const stmt of MIGRATIONS_SQL) {
    try {
      executor.exec(stmt);
    } catch {
      // Column/table already exists — skip
    }
  }
}
