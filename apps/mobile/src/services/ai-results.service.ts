/**
 * AI Results CRUD service — raw SQL.
 *
 * Mirrors the desktop IPC handlers in `electron/ipc/ai-results.ipc.ts`.
 */

import type { SQLiteDatabase, SQLiteBindValue } from "expo-sqlite";
import { AI_DATA_VERSION } from "@siltflow/shared-db/types";
import type { AIResultSaveResult } from "./types";

type DB = SQLiteDatabase;

const p = (v: unknown): SQLiteBindValue => v as SQLiteBindValue;

// ── Queries ──────────────────────────────────────────────────────────

/** Get AI result data for a single annotation (returns the raw JSON string). */
export function getAIResult(
  db: DB,
  annotationId: string,
  documentId: string,
): string | null {
  const row = db.getFirstSync<{ data: string }>(
    "SELECT data FROM ai_results WHERE annotation_id = ? AND document_id = ?",
    [p(annotationId), p(documentId)],
  );
  return row?.data ?? null;
}

/** List AI results for all annotations in a document. */
export function listAIResultsByDocument(
  db: DB,
  documentId: string,
): { annotationId: string; data: string }[] {
  const rows = db.getAllSync<{ annotation_id: string; data: string }>(
    "SELECT annotation_id, data FROM ai_results WHERE document_id = ?",
    [p(documentId)],
  );
  return rows.map((r) => ({
    annotationId: r.annotation_id,
    data: r.data,
  }));
}

// ── Mutations ────────────────────────────────────────────────────────

/** Insert or replace an AI result. Preserves original created_at on update. */
export function saveAIResult(
  db: DB,
  annotationId: string,
  documentId: string,
  data: unknown,
  version?: number,
): AIResultSaveResult {
  const now = new Date().toISOString();
  const v = version ?? AI_DATA_VERSION;
  db.runSync(
    `INSERT OR REPLACE INTO ai_results
       (annotation_id, document_id, data, version, created_at, updated_at)
     VALUES (?, ?, ?, ?,
       COALESCE((SELECT created_at FROM ai_results WHERE annotation_id = ? AND document_id = ?), ?),
       ?)`,
    [
      p(annotationId),
      p(documentId),
      p(JSON.stringify(data)),
      p(v),
      p(annotationId),
      p(documentId),
      p(now),
      p(now),
    ],
  );
  return { annotationId, version: v };
}

/** Delete an AI result. */
export function deleteAIResult(
  db: DB,
  annotationId: string,
  documentId: string,
): void {
  db.runSync(
    "DELETE FROM ai_results WHERE annotation_id = ? AND document_id = ?",
    [p(annotationId), p(documentId)],
  );
}
