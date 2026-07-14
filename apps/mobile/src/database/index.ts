import { CapacitorSQLite, SQLiteDBConnection } from "@capacitor-community/sqlite";

let db: SQLiteDBConnection | null = null;

const DB_NAME = "siltflow.db";

/**
 * Initialize the SQLite database and create tables if needed.
 *
 * Workflow (ref: capacitor-community/sqlite v8 Android API):
 *   1. createConnection → registers the connection
 *   2. open → opens the DB (auto-creates if not exists on Android)
 *   3. Check if tables exist, create if needed
 */
export async function initDatabase(): Promise<void> {
  try {
    const sqlite = CapacitorSQLite;

    // Register the connection
    await sqlite.createConnection({
      database: DB_NAME,
      encrypted: false,
      mode: "no-encryption",
      version: 1,
      readonly: false,
    });

    // Open the DB (auto-creates if not exists)
    await sqlite.open({ database: DB_NAME, readonly: false });

    // Check if our tables exist by looking for the "documents" table
    const tableResult = await sqlite.isTableExists({
      database: DB_NAME,
      table: "documents",
    });
    const tablesExist = tableResult?.result ?? false;

    if (!tablesExist) {
      await createTables();
    }

    // Retrieve the connection for queries
    const conn = (sqlite as any).retrieveConnection?.(DB_NAME, false) ?? null;
    // Alternative: use SQLiteConnection class for typed connection
    if (!conn) {
      // Fallback: use open's API directly via CapacitorSQLite
      db = null;
    } else {
      db = conn;
    }
  } catch (err) {
    // If the connection already exists, try retrieving it
    try {
      const sqlite = CapacitorSQLite;
      await sqlite.open({ database: DB_NAME, readonly: false });
      const conn = (sqlite as any).retrieveConnection?.(DB_NAME, false) ?? null;
      if (conn) db = conn;
    } catch {
      console.error("[DB] init error:", err);
      throw err;
    }
  }
}

/**
 * Get the database connection (must call initDatabase first).
 */
export function getDb(): SQLiteDBConnection {
  if (!db) throw new Error("Database not initialized — call initDatabase() first");
  return db;
}

/**
 * Execute a SQL query with optional params via CapacitorSQLite plugin.
 */
export async function executeSql(sql: string, params?: any[]): Promise<any[]> {
  const sqlite = CapacitorSQLite;
  const ret = await sqlite.query({
    database: DB_NAME,
    statement: sql,
    values: params ?? [],
  });
  return (ret?.values as any[]) ?? [];
}

/**
 * Execute a SQL statement (INSERT/UPDATE/DELETE) via CapacitorSQLite plugin.
 */
export async function runSql(sql: string, params?: any[]): Promise<{ changes: number }> {
  const sqlite = CapacitorSQLite;
  const ret = await sqlite.run({
    database: DB_NAME,
    statement: sql,
    values: params ?? [],
  });
  return { changes: ret?.changes?.changes ?? 0 };
}

// ── Schema ────────────────────────────────────────────────────────────────

async function createTables(): Promise<void> {
  const sqlite = CapacitorSQLite;

  const schema = `
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      original_name TEXT,
      total_pages INTEGER,
      metadata TEXT,
      folder_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS summaries (
      document_id TEXT NOT NULL PRIMARY KEY,
      text TEXT NOT NULL,
      is_ai_generated INTEGER NOT NULL DEFAULT 0,
      source_lang TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      type TEXT NOT NULL,
      text TEXT,
      page_number INTEGER,
      embed_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (id, document_id),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_results (
      annotation_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (annotation_id, document_id),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS review_logs (
      id TEXT NOT NULL,
      annotation_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (id, annotation_id, document_id),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fsrs_cards (
      annotation_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (annotation_id, document_id),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
  `;

  // Execute schema statements one by one
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await sqlite.run({
      database: DB_NAME,
      statement: stmt + ";",
      values: [],
    });
  }
}
