/**
 * Summary CRUD service — raw SQL for INSERT OR REPLACE.
 *
 * Mirrors the desktop IPC handlers in `electron/ipc/summaries.ipc.ts`.
 */

import type { SQLiteDatabase, SQLiteBindValue } from "expo-sqlite";
import type { SummarySaveRequest, SummarySaveResult } from "./types";

type DB = SQLiteDatabase;

const p = (v: unknown): SQLiteBindValue => v as SQLiteBindValue;

// ── Queries ──────────────────────────────────────────────────────────

/** Fetch all summaries. */
export function listAllSummaries(db: DB) {
  return db.getAllSync<Record<string, unknown>>(
    "SELECT * FROM summaries",
  );
}

/** Fetch a summary by document ID. */
export function getSummary(
  db: DB,
  documentId: string,
) {
  return db.getFirstSync<Record<string, unknown>>(
    "SELECT * FROM summaries WHERE document_id = ?",
    [p(documentId)],
  );
}

// ── Mutations ────────────────────────────────────────────────────────

/** Insert or replace a summary. Preserves original created_at on update. */
export function saveSummary(
  db: DB,
  summary: SummarySaveRequest,
): SummarySaveResult {
  const now = new Date().toISOString();
  db.runSync(
    `INSERT OR REPLACE INTO summaries
       (document_id, text, is_ai_generated, source_lang, created_at, updated_at)
     VALUES (?, ?, ?, ?,
       COALESCE((SELECT created_at FROM summaries WHERE document_id = ?), ?),
       ?)`,
    [
      p(summary.documentId),
      p(summary.text),
      p(summary.isAiGenerated ? 1 : 0),
      p(summary.sourceLang ?? null),
      p(summary.documentId),
      p(now),
      p(now),
    ],
  );
  return { documentId: summary.documentId };
}

/** Delete a summary by document ID. */
export function deleteSummary(db: DB, documentId: string): void {
  db.runSync(
    "DELETE FROM summaries WHERE document_id = ?",
    [p(documentId)],
  );
}
