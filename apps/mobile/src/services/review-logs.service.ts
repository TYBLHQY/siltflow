/**
 * Review Logs CRUD service — raw SQL.
 *
 * Mirrors the desktop IPC handlers in `electron/ipc/review-logs.ipc.ts`.
 */

import type { SQLiteDatabase, SQLiteBindValue } from "expo-sqlite";
import type { ReviewLogEntryIPC, ReviewLogSaveResult } from "./types";

type DB = SQLiteDatabase;

const p = (v: unknown): SQLiteBindValue => v as SQLiteBindValue;

// ── Helpers ──────────────────────────────────────────────────────────

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Row shapes ───────────────────────────────────────────────────────

interface ReviewLogRow {
  id: string;
  annotation_id: string;
  document_id: string;
  data: string;
  created_at: string;
}

// ── Queries ──────────────────────────────────────────────────────────

/** List review logs for a single annotation, most recent first. */
export function listReviewLogsByAnnotation(
  db: DB,
  annotationId: string,
  documentId: string,
): ReviewLogEntryIPC[] {
  const rows = db.getAllSync<ReviewLogRow>(
    `SELECT id, annotation_id, document_id, data, created_at
     FROM review_logs
     WHERE annotation_id = ? AND document_id = ?
     ORDER BY created_at DESC`,
    [p(annotationId), p(documentId)],
  );
  return rows.map((r) => ({
    id: r.id,
    annotationId: r.annotation_id,
    documentId: r.document_id,
    data: r.data,
    createdAt: r.created_at,
  }));
}

/** List all review logs (used for statistics). */
export function listAllReviewLogs(db: DB): ReviewLogEntryIPC[] {
  const rows = db.getAllSync<ReviewLogRow>(
    `SELECT id, annotation_id, document_id, data, created_at
     FROM review_logs
     ORDER BY created_at ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    annotationId: r.annotation_id,
    documentId: r.document_id,
    data: r.data,
    createdAt: r.created_at,
  }));
}

// ── Mutations ────────────────────────────────────────────────────────

/** Insert a new review log entry. */
export function saveReviewLog(
  db: DB,
  annotationId: string,
  documentId: string,
  data: unknown,
): ReviewLogSaveResult {
  const now = new Date().toISOString();
  const id = uuid();
  db.runSync(
    `INSERT INTO review_logs (id, annotation_id, document_id, data, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [p(id), p(annotationId), p(documentId), p(JSON.stringify(data)), p(now)],
  );
  return { id, createdAt: now };
}

/** Delete all review logs for an annotation. */
export function deleteReviewLogsByAnnotation(
  db: DB,
  annotationId: string,
  documentId: string,
): void {
  db.runSync(
    "DELETE FROM review_logs WHERE annotation_id = ? AND document_id = ?",
    [p(annotationId), p(documentId)],
  );
}
