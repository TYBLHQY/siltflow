import { ipcMain } from "electron"
import { getSqlite } from "../database"
import { AI_DATA_VERSION } from "../database"
import { recordDeletion } from "../sync/changelog"

export function registerAiResultHandlers() {
  ipcMain.handle("aiResults:get", (_event, annotationId: string, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = sql.prepare("SELECT data FROM ai_results WHERE annotation_id = ? AND document_id = ?").get(annotationId, documentId) as any
    return row?.data ?? null
  })

  ipcMain.handle("aiResults:listByDocument", (_event, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = sql.prepare("SELECT annotation_id, data FROM ai_results WHERE document_id = ?").all(documentId) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => ({ annotationId: r.annotation_id, data: r.data }))
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle("aiResults:save", (_event, record: { annotationId: string; documentId: string; data: any; version?: number }) => {
    const sql = getSqlite()
    if (!sql) return null
    const now = new Date().toISOString()
    sql.prepare(
      `INSERT OR REPLACE INTO ai_results (annotation_id, document_id, data, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM ai_results WHERE annotation_id = ? AND document_id = ?), ?), ?)`
    ).run(
      record.annotationId,
      record.documentId,
      JSON.stringify(record.data),
      record.version ?? AI_DATA_VERSION,
      record.annotationId,
      record.documentId,
      now,
      now,
    )
    return { annotationId: record.annotationId, version: record.version ?? AI_DATA_VERSION }
  })

  ipcMain.handle("aiResults:delete", (_event, annotationId: string, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return
    sql.prepare("DELETE FROM ai_results WHERE annotation_id = ? AND document_id = ?").run(annotationId, documentId)
    recordDeletion(sql, "ai_results", `${annotationId}|${documentId}`)
  })
}
