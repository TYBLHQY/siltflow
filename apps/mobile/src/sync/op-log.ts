/**
 * Sync operation log — records every local write so the push engine knows
 * exactly what to send.
 *
 * Replaces the old changelog (deletion-only) + timestamp-based change
 * detection. Every CRUD service now records a 'save' or 'delete' entry.
 * The push engine reads the log, sends the rows to the server, then clears
 * the sent entries.
 *
 * Uses expo-sqlite's synchronous API (JSI bridged) — safe in React Native.
 */

import { getSQLite } from "@/stores/db.store";
import { ENTITY_TABLES } from "@siltflow/shared-lib";

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

// -- Composite-PK tables ------------------------------------------------

const COMPOSITE_PK_TABLES: Record<string, string[]> = {
  annotations: ["id", "document_id"],
  ai_results: ["annotation_id", "document_id"],
  fsrs_cards: ["annotation_id", "document_id"],
  review_logs: ["id", "annotation_id", "document_id"],
};

// -- API -------------------------------------------------------------------

export function initOpLogTable(): void {
  const sql = getSQLite();
  sql.execSync(OP_LOG_DDL);
}

/** Record a save (INSERT or UPDATE). Pass the full row as it exists in the DB. */
export function recordSave(
  tableName: string,
  rowId: string,
  rowData: Record<string, unknown>,
): void {
  const sql = getSQLite();
  sql.runSync(
    "INSERT INTO sync_op_log (table_name, row_id, action, row_data, created_at) VALUES (?, ?, 'save', ?, ?)",
    tableName,
    rowId,
    JSON.stringify(rowData),
    new Date().toISOString(),
  );
}

/** Record a save using composite PK values (converted to pipe-delimited row_id). */
export function recordCompositeSave(
  tableName: string,
  pkValues: Record<string, string>,
  rowData: Record<string, unknown>,
): void {
  const cols = COMPOSITE_PK_TABLES[tableName];
  if (!cols) {
    if (pkValues.id) {
      recordSave(tableName, pkValues.id, rowData);
      return;
    }
    console.warn(`[op-log] Unknown composite PK for table ${tableName}`);
    return;
  }
  const rowId = cols.map((c) => pkValues[c] ?? "").join("|");
  recordSave(tableName, rowId, rowData);
}

/** Record a deletion. */
export function recordDelete(
  tableName: string,
  rowId: string,
): void {
  const sql = getSQLite();
  sql.runSync(
    "INSERT INTO sync_op_log (table_name, row_id, action, row_data, created_at) VALUES (?, ?, 'delete', NULL, ?)",
    tableName,
    rowId,
    new Date().toISOString(),
  );
}

/** Record a deletion for a table with a composite primary key. */
export function recordCompositeDelete(
  tableName: string,
  pkValues: Record<string, string>,
): void {
  const cols = COMPOSITE_PK_TABLES[tableName];
  if (!cols) {
    if (pkValues.id) {
      recordDelete(tableName, pkValues.id);
      return;
    }
    console.warn(`[op-log] Unknown composite PK for table ${tableName}`);
    return;
  }
  const rowId = cols.map((c) => pkValues[c] ?? "").join("|");
  recordDelete(tableName, rowId);
}

/** Record multiple deletions (e.g. batch delete). */
export function recordDeletes(
  tableName: string,
  rowIds: string[],
): void {
  const sql = getSQLite();
  const now = new Date().toISOString();
  for (const id of rowIds) {
    sql.runSync(
      "INSERT INTO sync_op_log (table_name, row_id, action, row_data, created_at) VALUES (?, ?, 'delete', NULL, ?)",
      tableName,
      id,
      now,
    );
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
export function getOpLogSince(since: string): OpLogEntry[] {
  const sql = getSQLite();
  return sql.getAllSync<OpLogEntry>(
    "SELECT id, table_name, row_id, action, row_data, created_at FROM sync_op_log WHERE created_at > ? ORDER BY created_at ASC",
    since,
  );
}

/** Remove log entries by their IDs after they've been successfully pushed. */
export function clearOpLogEntries(ids: number[]): void {
  if (ids.length === 0) return;
  const sql = getSQLite();
  const placeholders = ids.map(() => "?").join(", ");
  sql.runSync(
    `DELETE FROM sync_op_log WHERE id IN (${placeholders})`,
    ...ids,
  );
}

// -- Migration ------------------------------------------------------------

/**
 * Seed the op_log with save entries for all existing rows across all
 * entity tables. Called once when the database already has data but
 * op_log is empty (first start after op_log migration, or epoch sync).
 */
export function seedOpLogFromExisting(): void {
  const sql = getSQLite();
  const now = new Date().toISOString();
  let totalRows = 0;

  for (const table of ENTITY_TABLES) {
    const rows = sql.getAllSync<Record<string, unknown>>(`SELECT * FROM ${table}`);
    if (rows.length === 0) continue;

    const cols = COMPOSITE_PK_TABLES[table];
    for (const row of rows) {
      let rowId: string;
      if (cols) {
        rowId = cols.map((c) => String(row[c] ?? "")).join("|");
      } else {
        rowId = String(row.id ?? "");
      }
      sql.runSync(
        "INSERT INTO sync_op_log (table_name, row_id, action, row_data, created_at) VALUES (?, ?, 'save', ?, ?)",
        table,
        rowId,
        JSON.stringify(row),
        now,
      );
      totalRows++;
    }
  }

  console.log(`[op-log] seedOpLogFromExisting — ${totalRows} rows seeded`);
}
