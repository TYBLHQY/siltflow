import type Database from "better-sqlite3"

/**
 * Run version-gated database migrations in order.
 * Each migration function handles one version step (e.g. v1→v2).
 *
 * IMPORTANT: migrations run BEFORE createTables(), so they operate on the
 * schema as it existed at the time the database was last used.  They must
 * handle both "old schema" and "table doesn't exist yet" cases.
 */
export function runMigrations(sqlite: Database.Database, currentVersion: number) {
  if (currentVersion < 2) {
    migrateV1toV2(sqlite)
  }
  if (currentVersion < 3) {
    migrateV2toV3(sqlite)
  }
}

// ── Migration 1→2: add version column to ai_results ────────────────

function migrateV1toV2(sqlite: Database.Database) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiCols = sqlite.prepare("PRAGMA table_info('ai_results')").all() as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!aiCols.some((c: any) => c.name === "version")) {
    sqlite.exec("ALTER TABLE ai_results ADD COLUMN version INTEGER NOT NULL DEFAULT 1")
  }
}

// ── Migration 2→3: add kind column to annotations ──────────────────

function migrateV2toV3(sqlite: Database.Database) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const annoCols = sqlite.prepare("PRAGMA table_info('annotations')").all() as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!annoCols.some((c: any) => c.name === "kind")) {
    sqlite.exec("ALTER TABLE annotations ADD COLUMN kind TEXT NOT NULL DEFAULT 'annotation'")
  }
}
