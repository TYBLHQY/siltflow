import { ipcMain } from "electron"
import { getDb, schema } from "../database"
import { eq } from "drizzle-orm"

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

  ipcMain.handle("documents:save", (_event, doc: typeof schema.documents.$inferInsert) => {
    const db = getDb()
    if (!db) return null
    const now = new Date().toISOString()
    return db
      .insert(schema.documents)
      .values({ ...doc, createdAt: now, updatedAt: now })
      .returning()
      .get()
  })
}
