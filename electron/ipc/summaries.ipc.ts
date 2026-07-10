import { ipcMain } from "electron"
import { getDb, getSqlite, schema } from "../database"
import { eq } from "drizzle-orm"

export function registerSummaryHandlers() {
  ipcMain.handle("summaries:get", (_event, documentId: string) => {
    const db = getDb()
    if (!db) return null
    return db
      .select()
      .from(schema.summaries)
      .where(eq(schema.summaries.documentId, documentId))
      .get()
  })

  ipcMain.handle("summaries:save", (_event, summary: { documentId: string; text: string; isAiGenerated: boolean }) => {
    const sql = getSqlite()
    if (!sql) return null
    const now = new Date().toISOString()
    sql.prepare(
      `INSERT OR REPLACE INTO summaries (document_id, text, is_ai_generated, created_at, updated_at)
       VALUES (?, ?, ?, COALESCE((SELECT created_at FROM summaries WHERE document_id = ?), ?), ?)`
    ).run(
      summary.documentId,
      summary.text,
      summary.isAiGenerated ? 1 : 0,
      summary.documentId,
      now,
      now,
    )
    return { documentId: summary.documentId }
  })

  ipcMain.handle("summaries:delete", (_event, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return
    sql.prepare("DELETE FROM summaries WHERE document_id = ?").run(documentId)
  })
}
