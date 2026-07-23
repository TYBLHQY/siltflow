/**
 * Sync changelog — tracks local deletions so the push engine knows what to
 * send. Creates and updates are detected via timestamp queries on the main
 * tables; deletions leave no row behind, hence this table.
 *
 * Uses expo-sqlite's synchronous API (JSI bridged) — safe in React Native.
 *
 * Adapted from apps/desktop/electron/sync/changelog.ts
 */

import { getSQLite } from "@/stores/db.store";

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

// ── Composite-PK tables ─────────────────────────────────────────────

/**
 * Tables whose identity cannot be expressed by a single `id` column.
 * For these the `row_id` in changelog / tombstones uses pipe-delimited
 * segments, e.g. `"annotationId|documentId"`.
 */
const COMPOSITE_PK_TABLES: Record<string, string[]> = {
  annotations: ["id", "document_id"],
  ai_results: ["annotation_id", "document_id"],
  fsrs_cards: ["annotation_id", "document_id"],
  review_logs: ["id", "annotation_id", "document_id"],
};

// ── API ───────────────────────────────────────────────────────────────

export function initChangelogTable(): void {
  const sql = getSQLite();
  sql.execSync(CHANGELOG_DDL);
}

/** Record a single-row deletion (simple PK table — just an id). */
export function recordDeletion(
  tableName: string,
  rowId: string,
): void {
  const sql = getSQLite();
  sql.runSync(
    "INSERT INTO sync_changelog (table_name, row_id, action, created_at) VALUES (?, ?, 'delete', ?)",
    tableName,
    rowId,
    new Date().toISOString(),
  );
}

/** Record a deletion for a table with a composite primary key. */
export function recordCompositeDeletion(
  tableName: string,
  pkValues: Record<string, string>,
): void {
  const cols = COMPOSITE_PK_TABLES[tableName];
  if (!cols) {
    // Fall back to id if present
    if (pkValues.id) {
      recordDeletion(tableName, pkValues.id);
      return;
    }
    console.warn(`[changelog] Unknown composite PK for table ${tableName}`);
    return;
  }
  const rowId = cols.map((c) => pkValues[c] ?? "").join("|");
  recordDeletion(tableName, rowId);
}

/** Record multiple deletions (e.g. batch delete). */
export function recordDeletions(
  tableName: string,
  rowIds: string[],
): void {
  const sql = getSQLite();
  const now = new Date().toISOString();
  for (const id of rowIds) {
    sql.runSync(
      "INSERT INTO sync_changelog (table_name, row_id, action, created_at) VALUES (?, ?, 'delete', ?)",
      tableName,
      id,
      now,
    );
  }
}

/**
 * Get all deletions since a given timestamp.
 * Returns rows with { id, table_name, row_id, created_at }.
 */
export function getDeletionsSince(
  since: string,
): Array<{ id: number; table_name: string; row_id: string; created_at: string }> {
  const sql = getSQLite();
  return sql.getAllSync<{
    id: number;
    table_name: string;
    row_id: string;
    created_at: string;
  }>(
    "SELECT id, table_name, row_id, created_at FROM sync_changelog WHERE created_at > ? ORDER BY created_at ASC",
    since,
  );
}

/** Remove changelog entries by their IDs after they've been successfully pushed. */
export function clearDeletions(ids: number[]): void {
  if (ids.length === 0) return;
  const sql = getSQLite();
  const placeholders = ids.map(() => "?").join(", ");
  sql.runSync(
    `DELETE FROM sync_changelog WHERE id IN (${placeholders})`,
    ...ids,
  );
}
