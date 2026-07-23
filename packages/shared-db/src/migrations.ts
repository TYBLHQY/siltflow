/**
 * Shared SQLite migrations — DDL statements and version-gated migrations.
 *
 * This module exports:
 * - CREATE_TABLE_STATEMENTS: idempotent CREATE TABLE IF NOT EXISTS for all 7 tables
 * - runMigrations(): version-gated ALTER TABLE migrations (v1→v4)
 *
 * Both desktop (better-sqlite3) and mobile (expo-sqlite) call these.
 */

import type { SqlExecutor } from "./db";
import { SCHEMA_VERSION } from "./types";

// ── Table creation statements (idempotent) ───────────────────────────

export const CREATE_TABLE_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    original_name TEXT,
    total_pages INTEGER,
    metadata TEXT,
    folder_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS annotations (
    id TEXT NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    text TEXT,
    page_number INTEGER,
    embed_data TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'annotation',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (id, document_id)
  );`,

  `CREATE TABLE IF NOT EXISTS ai_results (
    annotation_id TEXT NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (annotation_id, document_id)
  );`,

  `CREATE TABLE IF NOT EXISTS fsrs_cards (
    annotation_id TEXT NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (annotation_id, document_id)
  );`,

  `CREATE TABLE IF NOT EXISTS summaries (
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_ai_generated INTEGER NOT NULL DEFAULT 0,
    source_lang TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (document_id)
  );`,

  `CREATE TABLE IF NOT EXISTS review_logs (
    id TEXT NOT NULL,
    annotation_id TEXT NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (id, annotation_id, document_id)
  );`,
];

// ── Version-gated migrations ─────────────────────────────────────────

/**
 * Run version-gated database migrations in order.
 * Each migration handles one version step (v1→v2, v2→v3, etc.).
 *
 * IMPORTANT: Migrations run BEFORE createTables() so they operate on the
 * schema as it existed at the time the database was last used.
 */
export function runMigrations(
  executor: SqlExecutor,
  currentVersion: number,
): void {
  if (currentVersion < 2) {
    migrateV1toV2(executor);
  }
  if (currentVersion < 3) {
    migrateV2toV3(executor);
  }
  if (currentVersion < 4) {
    migrateV3toV4(executor);
  }
}

/**
 * Initialize a fresh or existing database:
 * 1. Create all tables if they don't exist
 * 2. Run any pending version-gated migrations
 * 3. Update PRAGMA user_version
 */
export function initSchema(
  executor: SqlExecutor,
  currentVersion: number,
): void {
  // Create tables (idempotent)
  for (const stmt of CREATE_TABLE_STATEMENTS) {
    executor.exec(stmt);
  }

  // Run version-gated migrations if needed
  if (currentVersion < SCHEMA_VERSION) {
    runMigrations(executor, currentVersion);
  }
}

// ── Migration implementations ────────────────────────────────────────

function migrateV1toV2(executor: SqlExecutor): void {
  // Add version column to ai_results
  const aiCols = executor.all<{ name: string }>(
    "PRAGMA table_info('ai_results')",
  );
  if (!aiCols.some((c) => c.name === "version")) {
    executor.exec(
      "ALTER TABLE ai_results ADD COLUMN version INTEGER NOT NULL DEFAULT 1",
    );
  }
}

function migrateV2toV3(executor: SqlExecutor): void {
  // Add kind column to annotations
  const annoCols = executor.all<{ name: string }>(
    "PRAGMA table_info('annotations')",
  );
  if (!annoCols.some((c) => c.name === "kind")) {
    executor.exec(
      "ALTER TABLE annotations ADD COLUMN kind TEXT NOT NULL DEFAULT 'annotation'",
    );
  }
}

function migrateV3toV4(executor: SqlExecutor): void {
  // Safety net: verify kind column exists
  const annoCols = executor.all<{ name: string }>(
    "PRAGMA table_info('annotations')",
  );
  if (!annoCols.some((c) => c.name === "kind")) {
    executor.exec(
      "ALTER TABLE annotations ADD COLUMN kind TEXT NOT NULL DEFAULT 'annotation'",
    );
  }
}
