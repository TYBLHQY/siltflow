import { ipcMain } from "electron"
import { getSqlite } from "../database"
import crypto from "node:crypto"

export function registerReviewLogHandlers() {
  ipcMain.handle("reviewLogs:listByAnnotation", (_event, annotationId: string, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return []
    const rows = sql
      .prepare("SELECT id, annotation_id, document_id, data, created_at FROM review_logs WHERE annotation_id = ? AND document_id = ? ORDER BY created_at DESC")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .all(annotationId, documentId) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => ({
      id: r.id,
      annotationId: r.annotation_id,
      documentId: r.document_id,
      data: r.data,
      createdAt: r.created_at,
    }))
  })

  ipcMain.handle("reviewLogs:listAll", () => {
    const sql = getSqlite()
    if (!sql) return []
    const rows = sql
      .prepare("SELECT id, annotation_id, document_id, data, created_at FROM review_logs ORDER BY created_at ASC")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .all() as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => ({
      id: r.id,
      annotationId: r.annotation_id,
      documentId: r.document_id,
      data: r.data,
      createdAt: r.created_at,
    }))
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle("reviewLogs:save", (_event, record: { annotationId: string; documentId: string; data: any }) => {
    const sql = getSqlite()
    if (!sql) return null
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    sql.prepare(
      `INSERT INTO review_logs (id, annotation_id, document_id, data, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(id, record.annotationId, record.documentId, JSON.stringify(record.data), now)
    return { id, createdAt: now }
  })

  ipcMain.handle("reviewLogs:deleteByAnnotation", (_event, annotationId: string, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return
    sql.prepare("DELETE FROM review_logs WHERE annotation_id = ? AND document_id = ?").run(annotationId, documentId)
  })
}
