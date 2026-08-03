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
  if (currentVersion < 5) {
    migrateV4toV5(sqlite);
  }
  if (currentVersion < 6) {
    migrateV5toV6(sqlite);
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
    // New column defaults to the current schema (V2). Only affects columns
    // created now; pre-existing rows are set by the save path, not here.
    sqlite.exec(
      "ALTER TABLE ai_results ADD COLUMN version INTEGER NOT NULL DEFAULT 2",
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

// ── Migration 4→5: add context column to annotations ────────────────
// User-authored per-card context note. Additive nullable column — no backfill.

function migrateV4toV5(sqlite: Database.Database) {
  const annoCols = sqlite
    .prepare("PRAGMA table_info('annotations')")
    .all() as ColumnInfo[];
  // Table doesn't exist yet on a fresh DB — skip; createTables() makes it
  // with the context column already present.
  if (annoCols.length === 0) return;
  if (!annoCols.some((c: ColumnInfo) => c.name === "context")) {
    sqlite.exec("ALTER TABLE annotations ADD COLUMN context TEXT");
  }
}

// ── Migration 5→6: rename V2 blob field context → documentContext ──────────
// The auto document context in AIAnnotationDataV2 was renamed from `context`
// to `documentContext` to disambiguate it from the per-card user-authored
// note (which lives on the annotations.context column and is untouched).
// Rewrite the JSON blobs in ai_results.data in place — old field name is
// dropped, rows without the field are left as-is.

interface AiResultsRow {
  annotation_id: string;
  document_id: string;
  data: string;
}

function migrateV5toV6(sqlite: Database.Database) {
  const aiCols = sqlite
    .prepare("PRAGMA table_info('ai_results')")
    .all() as ColumnInfo[];
  // Table doesn't exist yet on a fresh DB — skip; createTables() makes it
  // empty and the new writer emits documentContext directly.
  if (aiCols.length === 0) return;

  const rows = sqlite
    .prepare("SELECT annotation_id, document_id, data FROM ai_results")
    .all() as AiResultsRow[];

  for (const row of rows) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(row.data) as Record<string, unknown>;
    } catch {
      // Corrupt / non-object data — nothing we can safely rewrite.
      continue;
    }
    if (typeof parsed !== "object" || parsed === null) continue;
    if (!("context" in parsed)) continue;

    const { context, ...rest } = parsed;
    if (context === undefined) continue; // nothing meaningful to move

    const updated = { ...rest, documentContext: context };
    sqlite
      .prepare(
        "UPDATE ai_results SET data = ?, updated_at = ? WHERE annotation_id = ? AND document_id = ?",
      )
      .run(
        JSON.stringify(updated),
        new Date().toISOString(),
        row.annotation_id,
        row.document_id,
      );
  }
}
