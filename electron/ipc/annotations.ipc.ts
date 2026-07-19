import { ipcMain } from "electron"
import { getDb, getSqlite } from "../database"
import { schema } from "../database"
import { invalidateReviewMetricsCache } from "./review.ipc"

function tryParseJson(data: string, fallback: unknown): unknown {
  try {
    return JSON.parse(data)
  } catch {
    return fallback
  }
}

export function registerAnnotationHandlers() {
  ipcMain.handle("annotations:list", (_event, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return []
    // Single query with LEFT JOINs — includes ai_result + fsrs_card data
    // so the renderer doesn't need N×2 separate IPC calls.
    const rows = sql.prepare(`
      SELECT
        a.id, a.document_id, a.type, a.text, a.page_number, a.embed_data,
        a.kind,
        a.created_at, a.updated_at,
        ar.data AS ai_data,
        ar.version AS ai_version,
        fc.data AS fsrs_data
      FROM annotations a
      LEFT JOIN ai_results ar ON ar.annotation_id = a.id AND ar.document_id = a.document_id
      LEFT JOIN fsrs_cards fc ON fc.annotation_id = a.id AND fc.document_id = a.document_id
      WHERE a.document_id = ?
    `)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .all(documentId) as any[]
    // Pre-parse JSON fields in the main process so the renderer
    // doesn't block the UI thread on N×sync JSON.parse calls.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => ({
      id: r.id,
      document_id: r.document_id,
      type: r.type,
      text: r.text,
      page_number: r.page_number,
      embed_data: tryParseJson(r.embed_data, {}),
      kind: r.kind || "annotation",
      created_at: r.created_at,
      updated_at: r.updated_at,
      ai_data: r.ai_data ? tryParseJson(r.ai_data, null) : null,
      ai_version: r.ai_version ?? null,
      fsrs_data: r.fsrs_data ? tryParseJson(r.fsrs_data, null) : null,
    }))
  })

  ipcMain.handle("annotations:listAll", () => {
    const db = getDb()
    if (!db) return []
    return db.select().from(schema.annotations).all()
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle("annotations:save", (_event, annotation: any) => {
    const sql = getSqlite()
    if (!sql) return null
    const now = new Date().toISOString()
    sql.prepare(
      `INSERT OR REPLACE INTO annotations (id, document_id, type, text, page_number, embed_data, kind, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      annotation.id,
      annotation.documentId,
      annotation.type || "highlight",
      annotation.text || "",
      annotation.pageNumber ?? 0,
      annotation.embedData || "",
      annotation.kind || "annotation",
      now,
      now,
    )
    invalidateReviewMetricsCache()
    return { id: annotation.id }
  })

  ipcMain.handle("annotations:delete", (_event, id: string, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return
    sql.exec("BEGIN TRANSACTION")
    try {
      // Delete child tables first (no FK cascade from annotations)
      sql.prepare("DELETE FROM ai_results WHERE annotation_id = ? AND document_id = ?").run(id, documentId)
      sql.prepare("DELETE FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?").run(id, documentId)
      sql.prepare("DELETE FROM review_logs WHERE annotation_id = ? AND document_id = ?").run(id, documentId)
      sql.prepare("DELETE FROM annotations WHERE id = ? AND document_id = ?").run(id, documentId)
      sql.exec("COMMIT")
      invalidateReviewMetricsCache()
    } catch (err) {
      sql.exec("ROLLBACK")
      throw err
    }
  })
}
