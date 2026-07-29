/**
 * Server-specific database migrations with version tracking.
 *
 * Creates server-only tables (devices, sync_tombstones, server_settings)
 * and handles incremental schema changes via version-gated ALTER TABLE.
 * The shared 7 tables are handled by @siltflow/shared-db's initSchema().
 *
 * ## Version tracking
 *
 * Shared-db uses `PRAGMA user_version` for its 7 tables.  Server tables
 * have their own version stored as `schema_version` in the `server_settings`
 * key-value table — this avoids conflating the two concerns.
 *
 * Bump SV_SCHEMA_VERSION and add a new entry to SERVER_MIGRATIONS when a
 * server-table schema change is needed.
 */

import type { SqlExecutor } from "@siltflow/shared-db/db";

// ── Current server schema version ──────────────────────────────────────

/** Highest server-table schema version known to this build. */
export const SV_SCHEMA_VERSION = 1;

// ── Idempotent table creation ──────────────────────────────────────────

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

  `CREATE TABLE IF NOT EXISTS server_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
];

// ── Version-gated migrations ───────────────────────────────────────────

/**
 * Ordered list of server-table migrations.
 *
 * Each entry runs only when the stored `schema_version` is lower than
 * `version`.  Use this for ALTER TABLE / CREATE INDEX / data backfills.
 *
 * IMPORTANT: add new entries at the END.  Never reorder or remove.
 */
const SERVER_MIGRATIONS: { version: number; sql: string }[] = [
  // v1 — add last_sync_at column to devices (for tracking sync timing per device)
  {
    version: 1,
    sql: `ALTER TABLE devices ADD COLUMN last_sync_at TEXT`,
  },
];

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Initialise server-only tables and run any pending migrations.
 *
 * @param executor      Platform-agnostic SQL executor (better-sqlite3 or expo-sqlite).
 * @param currentVersion The stored `schema_version` from server_settings, or 0 if absent.
 */
export function initServerSchema(
  executor: SqlExecutor,
  currentVersion: number,
): void {
  // 1. Create tables (idempotent — safe to run every startup)
  for (const stmt of SERVER_TABLES_SQL) {
    executor.exec(stmt);
  }

  // 2. Run version-gated migrations in order
  for (const m of SERVER_MIGRATIONS) {
    if (currentVersion < m.version) {
      try {
        executor.exec(m.sql);
      } catch {
        // Column / index may already exist from a prior run before version
        // tracking was in place.  This is a one-time safety net for
        // pre-existing databases; new migrations should never hit this.
        console.warn(
          `[server-db] Migration v${m.version} failed (may already exist):`,
          m.sql.slice(0, 80),
        );
      }
    }
  }

  // 3. Persist the version so future runs skip completed migrations
  if (currentVersion < SV_SCHEMA_VERSION) {
    executor.run(
      `INSERT OR REPLACE INTO server_settings (key, value, updated_at) VALUES (?, ?, ?)`,
      "schema_version",
      String(SV_SCHEMA_VERSION),
      new Date().toISOString(),
    );
  }
}
