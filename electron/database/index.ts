import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema"
import fs from "node:fs"
import path from "node:path"

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

  // Create tables
  createTables()

  return db
}

function createTables() {
  if (!sqlite) return

  // Create documents table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
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
      ai_result TEXT,
      fsrs_card TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (id, document_id)
    );
  `)

  // Migration: add ai_result column if missing
  const annoCols = cols.length > 0 ? cols : sqlite.prepare("PRAGMA table_info('annotations')").all() as any[]
  const hasAiResult = annoCols.some((c: any) => c.name === 'ai_result')
  if (!hasAiResult) {
    sqlite.exec("ALTER TABLE annotations ADD COLUMN ai_result TEXT")
  }
  const hasFsrs = annoCols.some((c: any) => c.name === 'fsrs_card')
  if (!hasFsrs) {
    sqlite.exec("ALTER TABLE annotations ADD COLUMN fsrs_card TEXT")
  }
}

export function getDb() {
  return db
}

export function getSqlite() {
  return sqlite
}

export { schema }
