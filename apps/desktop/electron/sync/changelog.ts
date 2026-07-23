/**
 * Sync changelog — tracks local deletions so the push engine knows what to
 * send. Creates and updates are detected via timestamp queries on the main
 * tables; deletions leave no row behind, hence this table.
 */

import type Database from "better-sqlite3";

// ── Schema ────────────────────────────────────────────────────────────

export const CHANGELOG_DDL = `
  CREATE TABLE IF NOT EXISTS sync_changelog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'delete',
    created_at TEXT NOT NULL
  );
`;

// ── API ────────────────────────────────────────────────────────────────

export function initChangelogTable(sql: Database.Database): void {
  sql.exec(CHANGELOG_DDL);
}

/** Record a single-row deletion. */
export function recordDeletion(
  sql: Database.Database,
  tableName: string,
  rowId: string,
): void {
  sql
    .prepare(
      "INSERT INTO sync_changelog (table_name, row_id, action, created_at) VALUES (?, ?, 'delete', ?)",
    )
    .run(tableName, rowId, new Date().toISOString());
}

/** Record multiple deletions (e.g. batch delete). */
export function recordDeletions(
  sql: Database.Database,
  tableName: string,
  rowIds: string[],
): void {
  const stmt = sql.prepare(
    "INSERT INTO sync_changelog (table_name, row_id, action, created_at) VALUES (?, ?, 'delete', ?)",
  );
  const now = new Date().toISOString();
  for (const id of rowIds) {
    stmt.run(tableName, id, now);
  }
}

/**
 * Get all deletions since a given timestamp.
 * Returns rows with { id, table_name, row_id, created_at }.
 */
export function getDeletionsSince(
  sql: Database.Database,
  since: string,
): Array<{ id: number; table_name: string; row_id: string; created_at: string }> {
  return sql
    .prepare(
      "SELECT id, table_name, row_id, created_at FROM sync_changelog WHERE created_at > ? ORDER BY created_at ASC",
    )
    .all(since) as Array<{
    id: number;
    table_name: string;
    row_id: string;
    created_at: string;
  }>;
}

/** Remove changelog entries by their IDs after they've been successfully pushed. */
export function clearDeletions(
  sql: Database.Database,
  ids: number[],
): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(", ");
  sql
    .prepare(`DELETE FROM sync_changelog WHERE id IN (${placeholders})`)
    .run(...ids);
}
