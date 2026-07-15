import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema"
import { runMigrations } from "./migration"
import fs from "node:fs"
import path from "node:path"

// ── Schema version ───────────────────────────────────────────────────
// Bump this when making backward-incompatible migrations.  The value is
// stored as PRAGMA user_version so we can detect and migrate existing
// databases on upgrade.
const SCHEMA_VERSION = 2

/** Current AI data version written to ai_results.version on save. */
export const AI_DATA_VERSION = 1

let db: ReturnType<typeof drizzle<typeof schema>> | null = null
let sqlite: Database.Database | null = null

export function initDatabase(vaultPath: string) {
  const dbDir = path.join(vaultPath, ".siltflow")
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  sqlite = new Database(path.join(dbDir, "data.db"))
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")

  db = drizzle(sqlite, { schema })

  // Check / migrate schema version
  const version = sqlite.pragma("user_version", { simple: true }) as number
  if (version < SCHEMA_VERSION) {
    // Run version-gated migrations in order before createTables,
    // so all database interactions see the final schema.
    runMigrations(sqlite, version)

    createTables()
    sqlite!.pragma(`user_version = ${SCHEMA_VERSION}`)
  } else {
    createTables()
  }

  return db
}

function createTables() {
  if (!sqlite) return

  // Create documents table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      original_name TEXT,
      total_pages INTEGER,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _check (id TEXT PRIMARY KEY);
    DROP TABLE _check;
  `)

  // Drop old-style annotations table if it exists with wrong PK
  const cols = sqlite.prepare("PRAGMA table_info('annotations')").all() as any[]
  const isOldSchema = cols.length > 0 && cols.filter((c: any) => c.pk > 0).length === 1
  if (isOldSchema) {
    sqlite.exec("DROP TABLE annotations")
  }

  // Create annotations with composite PK
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT NOT NULL,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      text TEXT,
      page_number INTEGER,
      embed_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (id, document_id)
    );
  `)

  // Migrate: drop old ai_result / fsrs_card columns if present (now in own tables)
  const annoCols = sqlite.prepare("PRAGMA table_info('annotations')").all() as any[]
  if (annoCols.some((c: any) => c.name === 'ai_result')) {
    sqlite.exec("ALTER TABLE annotations DROP COLUMN ai_result")
  }
  if (annoCols.some((c: any) => c.name === 'fsrs_card')) {
    sqlite.exec("ALTER TABLE annotations DROP COLUMN fsrs_card")
  }

  // Create ai_results table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ai_results (
      annotation_id TEXT NOT NULL,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (annotation_id, document_id)
    );
  `)

  // Create fsrs_cards table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS fsrs_cards (
      annotation_id TEXT NOT NULL,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (annotation_id, document_id)
    );
  `)

  // Create summaries table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS summaries (
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      is_ai_generated INTEGER NOT NULL DEFAULT 0,
      source_lang TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (document_id)
    );
  `)

  // Create review_logs table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS review_logs (
      id TEXT NOT NULL,
      annotation_id TEXT NOT NULL,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (id, annotation_id, document_id)
    );
  `)

  // Create folders table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  // Add folder_id column to documents if missing
  const docCols = sqlite.prepare("PRAGMA table_info('documents')").all() as any[]
  if (!docCols.some((c: any) => c.name === 'folder_id')) {
    sqlite.exec("ALTER TABLE documents ADD COLUMN folder_id TEXT")
  }
  if (!docCols.some((c: any) => c.name === 'sort_order')) {
    sqlite.exec("ALTER TABLE documents ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
  }
  if (!docCols.some((c: any) => c.name === 'original_name')) {
    try {
      sqlite.exec("ALTER TABLE documents ADD COLUMN original_name TEXT")
    } catch { /* already present in CREATE TABLE */ }
  }
  // Drop legacy columns if they exist
  if (docCols.some((c: any) => c.name === 'file_name')) {
    try { sqlite.exec("ALTER TABLE documents DROP COLUMN file_name") } catch {}
  }
  if (docCols.some((c: any) => c.name === 'file_path')) {
    try { sqlite.exec("ALTER TABLE documents DROP COLUMN file_path") } catch {}
  }
}

export function getDb() {
  return db
}

export function getSqlite() {
  return sqlite
}

export { schema }
