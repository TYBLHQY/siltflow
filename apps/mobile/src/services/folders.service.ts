/**
 * Folder CRUD service — uses Drizzle ORM.
 *
 * Mirrors the desktop IPC handlers in `electron/ipc/folders.ipc.ts`.
 */

import { eq } from "drizzle-orm";
import * as schema from "@siltflow/shared-db/schema";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import type { FolderRowIPC, FolderCreateParams } from "./types";

type DB = ExpoSQLiteDatabase<typeof schema>;

// ── Helpers ──────────────────────────────────────────────────────────

/** Generate a simple UUID v4 (no Node.js `crypto` dependency). */
function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Queries ──────────────────────────────────────────────────────────

/** Fetch all folders ordered by sortOrder. */
export function listFolders(db: DB): FolderRowIPC[] {
  return db.select().from(schema.folders).orderBy(schema.folders.sortOrder).all();
}

// ── Mutations ────────────────────────────────────────────────────────

/** Create a new folder. */
export function createFolder(
  db: DB,
  params: FolderCreateParams,
): FolderRowIPC {
  const now = new Date().toISOString();
  const id = uuid();
  return db
    .insert(schema.folders)
    .values({
      id,
      name: params.name,
      parentId: params.parentId ?? null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

/** Rename a folder. */
export function renameFolder(db: DB, id: string, name: string): void {
  const now = new Date().toISOString();
  db.update(schema.folders)
    .set({ name, updatedAt: now })
    .where(eq(schema.folders.id, id))
    .run();
}

/** Delete a folder and all descendants (recursive). */
export function deleteFolder(db: DB, id: string): void {
  // Collect all descendant folder IDs recursively
  function collectIds(parentId: string): string[] {
    const children = db
      .select()
      .from(schema.folders)
      .where(eq(schema.folders.parentId, parentId))
      .all();
    const result: string[] = [];
    for (const child of children) {
      result.push(child.id);
      result.push(...collectIds(child.id));
    }
    return result;
  }

  const allIds = [id, ...collectIds(id)];

  // Collect all document IDs in those folders
  const docIds: string[] = [];
  for (const fid of allIds) {
    const docs = db
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(eq(schema.documents.folderId, fid))
      .all();
    for (const d of docs) {
      docIds.push(d.id);
    }
  }

  // Delete documents from DB (cascade deletes annotations, summaries, etc.)
  for (const docId of docIds) {
    db.delete(schema.documents).where(eq(schema.documents.id, docId)).run();
  }

  // Delete folders
  for (const fid of allIds) {
    db.delete(schema.folders).where(eq(schema.folders.id, fid)).run();
  }
}

/** Move documents to a target folder (or root). */
export function moveDocuments(
  db: DB,
  docIds: string[],
  targetFolderId: string | null,
): void {
  const now = new Date().toISOString();
  for (const docId of docIds) {
    db.update(schema.documents)
      .set({ folderId: targetFolderId, updatedAt: now })
      .where(eq(schema.documents.id, docId))
      .run();
  }
}

/** Move a folder under a new parent (or root). */
export function moveFolder(
  db: DB,
  folderId: string,
  targetParentId: string | null,
): void {
  const now = new Date().toISOString();
  db.update(schema.folders)
    .set({ parentId: targetParentId, updatedAt: now })
    .where(eq(schema.folders.id, folderId))
    .run();
}

/** Bulk update sort_order for folders. */
export function updateFoldersSortOrder(
  db: DB,
  items: { id: string; sortOrder: number }[],
): void {
  const now = new Date().toISOString();
  for (const { id, sortOrder } of items) {
    db.update(schema.folders)
      .set({ sortOrder, updatedAt: now })
      .where(eq(schema.folders.id, id))
      .run();
  }
}
