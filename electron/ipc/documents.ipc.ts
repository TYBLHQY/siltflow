import { ipcMain } from "electron"
import { getDb, schema } from "../database"
import { eq } from "drizzle-orm"
import fs from "node:fs"
import path from "node:path"

let vaultPath = ""

export function setVaultPathForDocuments(p: string) {
  vaultPath = p
}

export function registerDocumentHandlers() {
  ipcMain.handle("documents:list", () => {
    const db = getDb()
    if (!db) return []
    return db.select().from(schema.documents).all()
  })

  ipcMain.handle("documents:get", (_event, id: string) => {
    const db = getDb()
    if (!db) return null
    return db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, id))
      .get()
  })

  ipcMain.handle("documents:save", (_event, doc: { id: string; title: string }) => {
    const db = getDb()
    if (!db) return null
    const now = new Date().toISOString()
    return db
      .insert(schema.documents)
      .values({ id: doc.id, title: doc.title, createdAt: now, updatedAt: now })
      .returning()
      .get()
  })

  ipcMain.handle("documents:delete", (_event, id: string) => {
    const db = getDb()
    if (!db) return
    if (vaultPath) {
      const docPath = path.join(vaultPath, 'documents', `${id}.pdf`)
      if (fs.existsSync(docPath)) {
        fs.rmSync(docPath, { force: true })
      }
    }
    db.delete(schema.documents).where(eq(schema.documents.id, id)).run()
  })

  ipcMain.handle("documents:deleteBatch", (_event, ids: string[]) => {
    const db = getDb()
    if (!db) return
    for (const id of ids) {
      if (vaultPath) {
        const docPath = path.join(vaultPath, 'documents', `${id}.pdf`)
        if (fs.existsSync(docPath)) {
          fs.rmSync(docPath, { force: true })
        }
      }
      db.delete(schema.documents).where(eq(schema.documents.id, id)).run()
    }
  })

  ipcMain.handle("documents:rename", (_event, { id, title }: { id: string; title: string }) => {
    const db = getDb()
    if (!db) return null
    const now = new Date().toISOString()
    db.update(schema.documents).set({ title, updatedAt: now }).where(eq(schema.documents.id, id)).run()
  })
}
