import { ipcMain } from "electron"
import { getDb, schema } from "../database"
import { eq } from "drizzle-orm"
import crypto from "crypto"
import fs from "node:fs"
import path from "node:path"

let vaultPath = ""

export function setVaultPathForFolders(p: string) {
  vaultPath = p
}

function getFullDb() {
  const db = getDb()
  if (!db) throw new Error("Database not initialized")
  return db
}

export function registerFolderHandlers() {
  // ── List all folders ──
  ipcMain.handle("folders:list", () => {
    const db = getFullDb()
    return db.select().from(schema.folders).orderBy(schema.folders.sortOrder).all()
  })

  // ── Create a folder ──
  ipcMain.handle("folders:create", (_event, { name, parentId }: { name: string; parentId?: string | null }) => {
    const db = getFullDb()
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    return db
      .insert(schema.folders)
      .values({ id, name, parentId: parentId ?? null, sortOrder: 0, createdAt: now, updatedAt: now })
      .returning()
      .get()
  })

  // ── Rename a folder ──
  ipcMain.handle("folders:rename", (_event, { id, name }: { id: string; name: string }) => {
    const db = getFullDb()
    db.update(schema.folders).set({ name, updatedAt: new Date().toISOString() }).where(eq(schema.folders.id, id)).run()
  })

  // ── Delete a folder (recursive — deletes all descendant docs + folders) ──
  ipcMain.handle("folders:delete", (_event, id: string) => {
    const db = getFullDb()

    // Collect all descendant folder IDs recursively
    function collectIds(parentId: string): string[] {
      const children = db.select().from(schema.folders).where(eq(schema.folders.parentId, parentId)).all()
      const result: string[] = []
      for (const child of children) {
        result.push(child.id)
        result.push(...collectIds(child.id))
      }
      return result
    }

    const allIds = [id, ...collectIds(id)]

    // Collect all document ids in those folders
    const docIds: string[] = []
    for (const fid of allIds) {
      const docs = db.select({ id: schema.documents.id }).from(schema.documents).where(eq(schema.documents.folderId, fid)).all()
      for (const d of docs) {
        docIds.push(d.id)
      }
    }

    // Delete document files from disk
    if (vaultPath) {
      for (const docId of docIds) {
        const docDir = path.join(vaultPath, 'documents', docId)
        if (fs.existsSync(docDir)) {
          fs.rmSync(docDir, { recursive: true, force: true })
        }
      }
    }

    // Delete documents from DB (cascade deletes annotations, summaries, etc.)
    for (const docId of docIds) {
      db.delete(schema.documents).where(eq(schema.documents.id, docId)).run()
    }

    // Delete folders (deepest first)
    for (const fid of allIds) {
      db.delete(schema.folders).where(eq(schema.folders.id, fid)).run()
    }
  })

  // ── Move documents to a target folder (or root) ──
  ipcMain.handle("folders:moveDocuments", (_event, { docIds, targetFolderId }: { docIds: string[]; targetFolderId: string | null }) => {
    const db = getFullDb()
    const now = new Date().toISOString()
    for (const docId of docIds) {
      db.update(schema.documents).set({ folderId: targetFolderId, updatedAt: now }).where(eq(schema.documents.id, docId)).run()
    }
  })

  // ── Move a folder under a new parent (or root) ──
  ipcMain.handle("folders:moveFolder", (_event, { folderId, targetParentId }: { folderId: string; targetParentId: string | null }) => {
    const db = getFullDb()
    db.update(schema.folders).set({ parentId: targetParentId, updatedAt: new Date().toISOString() }).where(eq(schema.folders.id, folderId)).run()
  })

  // ── Bulk update sort_order for folders ──
  ipcMain.handle("folders:updateSortOrder", (_event, items: { id: string; sortOrder: number }[]) => {
    const db = getFullDb()
    const now = new Date().toISOString()
    for (const { id, sortOrder } of items) {
      db.update(schema.folders).set({ sortOrder, updatedAt: now }).where(eq(schema.folders.id, id)).run()
    }
  })

  // ── Bulk update sort_order for documents ──
  ipcMain.handle("documents:updateSortOrder", (_event, items: { id: string; sortOrder: number }[]) => {
    const db = getFullDb()
    const now = new Date().toISOString()
    for (const { id, sortOrder } of items) {
      db.update(schema.documents).set({ sortOrder, updatedAt: now }).where(eq(schema.documents.id, id)).run()
    }
  })
}
