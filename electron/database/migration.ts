import type Database from "better-sqlite3";

/** PRAGMA table_info row */
interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

/**
 * Run version-gated database migrations in order.
 * Each migration function handles one version step (e.g. v1→v2).
 *
 * IMPORTANT: migrations run BEFORE createTables(), so they operate on the
 * schema as it existed at the time the database was last used.  They must
 * handle both "old schema" and "table doesn't exist yet" cases.
 */
export function runMigrations(
  sqlite: Database.Database,
  currentVersion: number,
) {
  if (currentVersion < 2) {
    migrateV1toV2(sqlite);
  }
  if (currentVersion < 3) {
    migrateV2toV3(sqlite);
  }
  if (currentVersion < 4) {
    migrateV3toV4(sqlite);
  }
}

// ── Migration 1→2: add version column to ai_results ────────────────

function migrateV1toV2(sqlite: Database.Database) {
  const aiCols = sqlite
    .prepare("PRAGMA table_info('ai_results')")
    .all() as ColumnInfo[];
  // Table doesn't exist yet on a fresh DB (migrations run before
  // createTables()) — skip the ALTER; createTables() creates it with the
  // version column already present.
  if (aiCols.length === 0) return;
  if (!aiCols.some((c: ColumnInfo) => c.name === "version")) {
    sqlite.exec(
      "ALTER TABLE ai_results ADD COLUMN version INTEGER NOT NULL DEFAULT 1",
    );
  }
}

// ── Migration 2→3: add kind column to annotations ──────────────────

function migrateV2toV3(sqlite: Database.Database) {
  const annoCols = sqlite
    .prepare("PRAGMA table_info('annotations')")
    .all() as ColumnInfo[];
  // Table doesn't exist yet on a fresh DB (migrations run before
  // createTables()) — skip the ALTER; createTables() creates it with the
  // kind column already present.
  if (annoCols.length === 0) return;
  if (!annoCols.some((c: ColumnInfo) => c.name === "kind")) {
    sqlite.exec(
      "ALTER TABLE annotations ADD COLUMN kind TEXT NOT NULL DEFAULT 'annotation'",
    );
  }
}

// ── Migration 3→4: verify kind column exists (no DDL needed — "manual" fits TEXT) ──

function migrateV3toV4(sqlite: Database.Database) {
  const annoCols = sqlite
    .prepare("PRAGMA table_info('annotations')")
    .all() as ColumnInfo[];
  // Table doesn't exist yet on a fresh DB — skip; createTables() will make it.
  if (annoCols.length === 0) return;
  if (!annoCols.some((c: ColumnInfo) => c.name === "kind")) {
    // Safety net: kind column should already exist from v2→v3
    sqlite.exec(
      "ALTER TABLE annotations ADD COLUMN kind TEXT NOT NULL DEFAULT 'annotation'",
    );
  }
}
