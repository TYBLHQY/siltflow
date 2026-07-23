import { ipcMain } from "electron"
import { getSqlite } from "../database"
import { invalidateReviewMetricsCache } from "./review.ipc"

export function registerFSRSCardHandlers() {
  ipcMain.handle("fsrsCards:get", (_event, annotationId: string, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = sql.prepare("SELECT data FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?").get(annotationId, documentId) as any
    return row?.data ?? null
  })

  ipcMain.handle("fsrsCards:listByDocument", (_event, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return []
    const rows = sql.prepare("SELECT annotation_id, data FROM fsrs_cards WHERE document_id = ?")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .all(documentId) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => ({ annotationId: r.annotation_id, data: r.data }))
  })

  ipcMain.handle("fsrsCards:listAll", () => {
    const sql = getSqlite()
    if (!sql) return []
    const rows = sql.prepare(
      "SELECT annotation_id, document_id, data, created_at, updated_at FROM fsrs_cards"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ).all() as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => ({
      annotationId: r.annotation_id,
      documentId: r.document_id,
      data: r.data,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    invalidateReviewMetricsCache()
    return { annotationId: record.annotationId }
  })

  ipcMain.handle("fsrsCards:delete", (_event, annotationId: string, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return
    sql.prepare("DELETE FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?").run(annotationId, documentId)
    invalidateReviewMetricsCache()
  })
}
