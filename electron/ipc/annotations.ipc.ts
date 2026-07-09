import { ipcMain } from "electron"
import { getDb, schema } from "../database"
import { eq } from "drizzle-orm"

export function registerAnnotationHandlers() {
  ipcMain.handle("annotations:list", (_event, documentId: string) => {
    const db = getDb()
    if (!db) return []
    return db
      .select()
      .from(schema.annotations)
      .where(eq(schema.annotations.documentId, documentId))
      .all()
  })

  ipcMain.handle("annotations:save", (_event, annotation: typeof schema.annotations.$inferInsert) => {
    const db = getDb()
    if (!db) return null
    const now = new Date().toISOString()
    return db
      .insert(schema.annotations)
      .values({ ...annotation, createdAt: now, updatedAt: now })
      .returning()
      .get()
  })

  ipcMain.handle("annotations:delete", (_event, id: string) => {
    const db = getDb()
    if (!db) return
    db.delete(schema.annotations).where(eq(schema.annotations.id, id)).run()
  })
}
