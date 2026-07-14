import { ipcMain } from "electron"
import { getSqlite } from "../database"

export function registerAiResultHandlers() {
  ipcMain.handle("aiResults:get", (_event, annotationId: string, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return null
    const row = sql.prepare("SELECT data FROM ai_results WHERE annotation_id = ? AND document_id = ?").get(annotationId, documentId) as any
    return row?.data ?? null
  })

  ipcMain.handle("aiResults:save", (_event, record: { annotationId: string; documentId: string; data: any }) => {
    const sql = getSqlite()
    if (!sql) return null
    const now = new Date().toISOString()
    sql.prepare(
      `INSERT OR REPLACE INTO ai_results (annotation_id, document_id, data, created_at, updated_at)
       VALUES (?, ?, ?, COALESCE((SELECT created_at FROM ai_results WHERE annotation_id = ? AND document_id = ?), ?), ?)`
    ).run(
      record.annotationId,
      record.documentId,
      JSON.stringify(record.data),
      record.annotationId,
      record.documentId,
      now,
      now,
    )
    return { annotationId: record.annotationId }
  })

  ipcMain.handle("aiResults:delete", (_event, annotationId: string, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return
    sql.prepare("DELETE FROM ai_results WHERE annotation_id = ? AND document_id = ?").run(annotationId, documentId)
  })
}
