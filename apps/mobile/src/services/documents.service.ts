/**
 * Document CRUD service — uses Drizzle ORM.
 *
 * Mirrors the desktop IPC handlers in `electron/ipc/documents.ipc.ts`.
 */

import { eq } from "drizzle-orm";
import * as schema from "@siltflow/shared-db/schema";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import type { DocumentIPCItem, DocumentSaveRequest } from "./types";

type DB = ExpoSQLiteDatabase<typeof schema>;

// ── Queries ──────────────────────────────────────────────────────────

/** Fetch all documents ordered by title. */
export function listDocuments(db: DB): DocumentIPCItem[] {
  return db.select().from(schema.documents).orderBy(schema.documents.title).all();
}

/** Fetch a single document by ID. */
export function getDocument(db: DB, id: string): DocumentIPCItem | undefined {
  return db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, id))
    .get();
}

// ── Mutations ────────────────────────────────────────────────────────

/** Insert a new document. */
export function saveDocument(
  db: DB,
  doc: DocumentSaveRequest,
): DocumentIPCItem {
  const now = new Date().toISOString();
  return db
    .insert(schema.documents)
    .values({ id: doc.id, title: doc.title, createdAt: now, updatedAt: now })
    .returning()
    .get();
}

/** Delete a document by ID. Cascade handles annotations, summaries, etc. */
export function deleteDocument(db: DB, id: string): void {
  db.delete(schema.documents).where(eq(schema.documents.id, id)).run();
}

/** Delete multiple documents. */
export function deleteDocuments(db: DB, ids: string[]): void {
  for (const id of ids) {
    db.delete(schema.documents).where(eq(schema.documents.id, id)).run();
  }
}

/** Rename a document (update title). */
export function renameDocument(
  db: DB,
  id: string,
  title: string,
): void {
  const now = new Date().toISOString();
  db.update(schema.documents)
    .set({ title, updatedAt: now })
    .where(eq(schema.documents.id, id))
    .run();
}

/** Update document metadata (totalPages + raw metadata JSON). */
export function updateDocumentMetadata(
  db: DB,
  id: string,
  totalPages: number,
  metadata: string,
): void {
  const now = new Date().toISOString();
  db.update(schema.documents)
    .set({ totalPages, metadata, updatedAt: now })
    .where(eq(schema.documents.id, id))
    .run();
}

/** Bulk update sort_order for documents. */
export function updateDocumentsSortOrder(
  db: DB,
  items: { id: string; sortOrder: number }[],
): void {
  const now = new Date().toISOString();
  for (const { id, sortOrder } of items) {
    db.update(schema.documents)
      .set({ sortOrder, updatedAt: now })
      .where(eq(schema.documents.id, id))
      .run();
  }
}
