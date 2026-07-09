import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import * as schema from "./schema"
import fs from "node:fs"
import path from "node:path"

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function initDatabase(vaultPath: string) {
  const dbDir = path.join(vaultPath, ".siltflow")
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const sqlite = new Database(path.join(dbDir, "data.db"))
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")

  db = drizzle(sqlite, { schema })

  // Create tables
  createTables()

  return db
}

function createTables() {
  if (!db) return

  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      total_pages INTEGER,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      text TEXT,
      page_number INTEGER,
      embed_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
}

export function getDb() {
  return db
}

export { schema }
