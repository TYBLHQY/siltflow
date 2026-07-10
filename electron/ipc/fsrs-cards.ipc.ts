import { ipcMain } from "electron"
import { getSqlite } from "../database"

export function registerFSRSCardHandlers() {
  ipcMain.handle("fsrsCards:get", (_event, annotationId: string, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return null
    const row = sql.prepare("SELECT data FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?").get(annotationId, documentId) as any
    return row?.data ?? null
  })

  ipcMain.handle("fsrsCards:save", (_event, record: { annotationId: string; documentId: string; data: any }) => {
    const sql = getSqlite()
    if (!sql) return null
    const now = new Date().toISOString()
    sql.prepare(
      `INSERT OR REPLACE INTO fsrs_cards (annotation_id, document_id, data, created_at, updated_at)
       VALUES (?, ?, ?, COALESCE((SELECT created_at FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?), ?), ?)`
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

  ipcMain.handle("fsrsCards:delete", (_event, annotationId: string, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return
    sql.prepare("DELETE FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?").run(annotationId, documentId)
  })
}
