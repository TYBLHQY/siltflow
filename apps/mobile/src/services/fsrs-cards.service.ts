/**
 * FSRS Cards CRUD service — raw SQL.
 *
 * Mirrors the desktop IPC handlers in `electron/ipc/fsrs-cards.ipc.ts`.
 */

import type { SQLiteDatabase, SQLiteBindValue } from "expo-sqlite";
import type { FSRSCardSaveResult } from "./types";

type DB = SQLiteDatabase;

const p = (v: unknown): SQLiteBindValue => v as SQLiteBindValue;

// ── Row shapes ───────────────────────────────────────────────────────

export interface FSRSCardRow {
  annotationId: string;
  documentId: string;
  data: string;
  createdAt: string;
  updatedAt: string;
}

// ── Queries ──────────────────────────────────────────────────────────

/** Get FSRS card data for a single annotation (returns the raw JSON string). */
export function getFSRSCard(
  db: DB,
  annotationId: string,
  documentId: string,
): string | null {
  const row = db.getFirstSync<{ data: string }>(
    "SELECT data FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?",
    [p(annotationId), p(documentId)],
  );
  return row?.data ?? null;
}

/** List FSRS cards for all annotations in a document. */
export function listFSRSCardsByDocument(
  db: DB,
  documentId: string,
): { annotationId: string; data: string }[] {
  const rows = db.getAllSync<{ annotation_id: string; data: string }>(
    "SELECT annotation_id, data FROM fsrs_cards WHERE document_id = ?",
    [p(documentId)],
  );
  return rows.map((r) => ({
    annotationId: r.annotation_id,
    data: r.data,
  }));
}

/** List all FSRS cards (used for statistics). */
export function listAllFSRSCards(db: DB): FSRSCardRow[] {
  const rows = db.getAllSync<{
    annotation_id: string;
    document_id: string;
    data: string;
    created_at: string;
    updated_at: string;
  }>(
    "SELECT annotation_id, document_id, data, created_at, updated_at FROM fsrs_cards",
  );
  return rows.map((r) => ({
    annotationId: r.annotation_id,
    documentId: r.document_id,
    data: r.data,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

// ── Mutations ────────────────────────────────────────────────────────

/** Insert or replace an FSRS card. Preserves original created_at on update. */
export function saveFSRSCard(
  db: DB,
  annotationId: string,
  documentId: string,
  data: unknown,
): FSRSCardSaveResult {
  const now = new Date().toISOString();
  db.runSync(
    `INSERT OR REPLACE INTO fsrs_cards
       (annotation_id, document_id, data, created_at, updated_at)
     VALUES (?, ?, ?,
       COALESCE((SELECT created_at FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?), ?),
       ?)`,
    [
      p(annotationId),
      p(documentId),
      p(JSON.stringify(data)),
      p(annotationId),
      p(documentId),
      p(now),
      p(now),
    ],
  );
  return { annotationId };
}

/** Delete an FSRS card. */
export function deleteFSRSCard(
  db: DB,
  annotationId: string,
  documentId: string,
): void {
  db.runSync(
    "DELETE FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?",
    [p(annotationId), p(documentId)],
  );
}
