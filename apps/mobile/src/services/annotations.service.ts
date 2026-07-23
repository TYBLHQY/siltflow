/**
 * Annotation service — enriched queries with LEFT JOINs.
 *
 * Uses expo-sqlite native SQLiteDatabase for raw SQL (INSERT OR REPLACE,
 * multi-table transactions). Returns enriched domain types with parsed
 * JSON columns.
 *
 * Mirrors the desktop IPC handlers in `electron/ipc/annotations.ipc.ts`,
 * `ai-results.ipc.ts`, and `fsrs-cards.ipc.ts`.
 */

import type { SQLiteDatabase, SQLiteBindValue } from "expo-sqlite";
import type { AnnotationEnriched, AnnotationSaveRequest } from "./types";

type DB = SQLiteDatabase;

// ── JSON helpers ─────────────────────────────────────────────────────

function tryParseJson(data: string, fallback: unknown): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

// ── Row shapes returned by expo-sqlite for annotation queries ────────

interface AnnotationJoinedRow {
  id: string;
  document_id: string;
  type: string;
  text: string | null;
  page_number: number | null;
  embed_data: string;
  kind: string;
  created_at: string;
  updated_at: string;
  ai_data: string | null;
  ai_version: number | null;
  fsrs_data: string | null;
}

function mapEnriched(row: AnnotationJoinedRow): AnnotationEnriched {
  return {
    id: row.id,
    document_id: row.document_id,
    type: row.type,
    text: row.text,
    page_number: row.page_number,
    embed_data: tryParseJson(row.embed_data, {}),
    kind: row.kind || "annotation",
    created_at: row.created_at,
    updated_at: row.updated_at,
    ai_data: row.ai_data ? tryParseJson(row.ai_data, null) : null,
    ai_version: row.ai_version ?? null,
    fsrs_data: row.fsrs_data
      ? tryParseJson(row.fsrs_data, null)
      : null,
  };
}

const ENRICHED_SQL = `
  SELECT
    a.id, a.document_id, a.type, a.text, a.page_number, a.embed_data,
    a.kind, a.created_at, a.updated_at,
    ar.data AS ai_data, ar.version AS ai_version,
    fc.data AS fsrs_data
  FROM annotations a
  LEFT JOIN ai_results ar ON ar.annotation_id = a.id AND ar.document_id = a.document_id
  LEFT JOIN fsrs_cards fc ON fc.annotation_id = a.id AND fc.document_id = a.document_id
`;

// ── Queries ──────────────────────────────────────────────────────────

/** Fetch all enriched annotations for a document. */
export function listAnnotations(
  db: DB,
  documentId: string,
): AnnotationEnriched[] {
  const rows = db.getAllSync<AnnotationJoinedRow>(
    `${ENRICHED_SQL} WHERE a.document_id = ?`,
    [documentId as SQLiteBindValue],
  );
  return rows.map(mapEnriched);
}

/** Fetch all enriched annotations across all documents. */
export function listAllAnnotations(db: DB): AnnotationEnriched[] {
  const rows = db.getAllSync<AnnotationJoinedRow>(ENRICHED_SQL);
  return rows.map(mapEnriched);
}

// ── Mutations ────────────────────────────────────────────────────────

/** Insert or replace a core annotation row. */
export function saveAnnotation(
  db: DB,
  annotation: AnnotationSaveRequest,
): { id: string } {
  const now = new Date().toISOString();
  const p = (v: unknown): SQLiteBindValue => v as SQLiteBindValue;
  db.runSync(
    `INSERT OR REPLACE INTO annotations
       (id, document_id, type, text, page_number, embed_data, kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p(annotation.id),
      p(annotation.document_id),
      p(annotation.type || "highlight"),
      p(annotation.text || ""),
      p(annotation.page_number ?? 0),
      p(annotation.embed_data || ""),
      p(annotation.kind || "annotation"),
      p(now),
      p(now),
    ],
  );
  return { id: annotation.id };
}

/** Delete an annotation and all child rows (cascade in a transaction). */
export function deleteAnnotation(
  db: DB,
  id: string,
  documentId: string,
): void {
  const p = (v: unknown): SQLiteBindValue => v as SQLiteBindValue;
  db.execSync("BEGIN TRANSACTION");
  try {
    db.runSync(
      "DELETE FROM ai_results WHERE annotation_id = ? AND document_id = ?",
      [p(id), p(documentId)],
    );
    db.runSync(
      "DELETE FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?",
      [p(id), p(documentId)],
    );
    db.runSync(
      "DELETE FROM review_logs WHERE annotation_id = ? AND document_id = ?",
      [p(id), p(documentId)],
    );
    db.runSync(
      "DELETE FROM annotations WHERE id = ? AND document_id = ?",
      [p(id), p(documentId)],
    );
    db.execSync("COMMIT");
  } catch (err) {
    db.execSync("ROLLBACK");
    throw err;
  }
}
