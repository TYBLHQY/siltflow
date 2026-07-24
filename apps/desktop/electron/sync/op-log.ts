/**
 * Sync operation log — records every local write so the push engine knows
 * exactly what to send.
 *
 * Replaces the old changelog (deletion-only) + timestamp-based change
 * detection. Every CRUD handler now records a 'save' or 'delete' entry.
 * The push engine reads the log, sends the rows to the server, then clears
 * the sent entries.
 *
 * Design: single-user system, server is a database mirror. No conflict
 * detection needed — the last writer wins.
 */

import type Database from "better-sqlite3";
import { ENTITY_TABLES } from "@siltflow/shared-lib";

// -- Composite PK tables -------------------------------------------------

const COMPOSITE_PK_TABLES: Record<string, string[]> = {
  annotations: ["id", "document_id"],
  ai_results: ["annotation_id", "document_id"],
  fsrs_cards: ["annotation_id", "document_id"],
  review_logs: ["id", "annotation_id", "document_id"],
};

// -- Schema ----------------------------------------------------------------

export const OP_LOG_DDL = `
  CREATE TABLE IF NOT EXISTS sync_op_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('save', 'delete')),
    row_data TEXT,
    created_at TEXT NOT NULL
  );
`;

export function initOpLogTable(sql: Database.Database): void {
  sql.exec(OP_LOG_DDL);
}

// -- API -------------------------------------------------------------------

/** Record a save (INSERT or UPDATE). Pass the full row as it exists in the DB. */
export function recordSave(
  sql: Database.Database,
  tableName: string,
  rowId: string,
  rowData: Record<string, unknown>,
): void {
  sql.prepare(
    "INSERT INTO sync_op_log (table_name, row_id, action, row_data, created_at) VALUES (?, ?, 'save', ?, ?)"
  ).run(tableName, rowId, JSON.stringify(rowData), new Date().toISOString());
}

/** Record a deletion. */
export function recordDelete(
  sql: Database.Database,
  tableName: string,
  rowId: string,
): void {
  sql.prepare(
    "INSERT INTO sync_op_log (table_name, row_id, action, row_data, created_at) VALUES (?, ?, 'delete', NULL, ?)"
  ).run(tableName, rowId, new Date().toISOString());
}

/** Record multiple deletions (e.g. batch delete). */
export function recordDeletes(
  sql: Database.Database,
  tableName: string,
  rowIds: string[],
): void {
  const stmt = sql.prepare(
    "INSERT INTO sync_op_log (table_name, row_id, action, row_data, created_at) VALUES (?, ?, 'delete', NULL, ?)"
  );
  const now = new Date().toISOString();
  for (const id of rowIds) {
    stmt.run(tableName, id, now);
  }
}

export interface OpLogEntry {
  id: number;
  table_name: string;
  row_id: string;
  action: "save" | "delete";
  row_data: string | null;
  created_at: string;
}

/** Get all operation log entries since a given timestamp. */
export function getOpLogSince(
  sql: Database.Database,
  since: string,
): OpLogEntry[] {
  return sql.prepare(
    "SELECT id, table_name, row_id, action, row_data, created_at FROM sync_op_log WHERE created_at > ? ORDER BY created_at ASC"
  ).all(since) as OpLogEntry[];
}

/** Remove log entries by their IDs after they've been successfully pushed. */
export function clearOpLogEntries(
  sql: Database.Database,
  ids: number[],
): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(", ");
  sql.prepare(
    `DELETE FROM sync_op_log WHERE id IN (${placeholders})`
  ).run(...ids);
}

// -- Migration ------------------------------------------------------------

/**
 * Seed the op_log with save entries for all existing rows across all
 * entity tables. Called once when the database already has data but
 * op_log is empty (first start after op_log migration, or epoch sync).
 */
export function seedOpLogFromExisting(sql: Database.Database): void {
  const now = new Date().toISOString();
  let totalRows = 0;

  for (const table of ENTITY_TABLES) {
    const rows = sql.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
    if (rows.length === 0) continue;

    const cols = COMPOSITE_PK_TABLES[table];
    const stmt = sql.prepare(
      "INSERT INTO sync_op_log (table_name, row_id, action, row_data, created_at) VALUES (?, ?, 'save', ?, ?)"
    );

    for (const row of rows) {
      let rowId: string;
      if (cols) {
        rowId = cols.map((c) => String(row[c] ?? "")).join("|");
      } else {
        rowId = String(row.id ?? "");
      }
      stmt.run(table, rowId, JSON.stringify(row), now);
      totalRows++;
    }
  }

  console.log(`[Sync:Desktop] seedOpLogFromExisting — ${totalRows} rows seeded across all tables`);
}
