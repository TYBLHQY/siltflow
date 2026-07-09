import { ipcMain } from "electron"
import { getDb } from "../database"
import { eq } from "drizzle-orm"
import { schema } from "../database"

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

  ipcMain.handle("annotations:save", (_event, annotation: any) => {
    const db = getDb()
    if (!db) return null
    const now = new Date().toISOString()
    // Use INSERT OR REPLACE to handle duplicates
    db.run(
      `INSERT OR REPLACE INTO annotations (id, document_id, type, text, page_number, embed_data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        annotation.id,
        annotation.documentId,
        annotation.type || "highlight",
        annotation.text || "",
        annotation.pageNumber ?? 0,
        annotation.embedData || "",
        now,
        now,
      ]
    )
    return { id: annotation.id }
  })

  ipcMain.handle("annotations:delete", (_event, id: string) => {
    const db = getDb()
    if (!db) return
    db.delete(schema.annotations).where(eq(schema.annotations.id, id)).run()
  })
}
