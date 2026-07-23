import { ipcMain } from "electron"
import { getSqlite } from "../database"
import { invalidateReviewMetricsCache } from "./review.ipc"
import { recordDeletion } from "../sync/changelog"

function tryParseJson(data: string, fallback: unknown): unknown {
  try {
    return JSON.parse(data)
  } catch {
    return fallback
  }
}

// ── Row shapes returned by better-sqlite3 .all() for annotation queries ──

interface AnnotationJoinedRow {
  id: string
  document_id: string
  type: string
  text: string | null
  page_number: number | null
  embed_data: string
  kind: string
  created_at: string
  updated_at: string
  ai_data: string | null
  ai_version: number | null
  fsrs_data: string | null
}

interface AnnotationEnrichedValue {
  id: string
  document_id: string
  type: string
  text: string | null
  page_number: number | null
  embed_data: unknown
  kind: string
  created_at: string
  updated_at: string
  ai_data: unknown
  ai_version: number | null
  fsrs_data: unknown
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Map a raw joined row to the enriched shape the renderer expects. */
function mapEnriched(row: AnnotationJoinedRow): AnnotationEnrichedValue {
  return {
    id: row.id,
    document_id: row.document_id,
    type: row.type,
    text: row.text,
    page_number: row.page_number,
    embed_data: tryParseJson(row.embed_data, {}),
    kind: row.kind || "annotation",
    created_at: row.created_at,
    updated_at: row.updated_at,
    ai_data: row.ai_data ? tryParseJson(row.ai_data, null) : null,
    ai_version: row.ai_version ?? null,
    fsrs_data: row.fsrs_data ? tryParseJson(row.fsrs_data, null) : null,
  }
}

const LIST_ALL_SQL = `
  SELECT
    a.id, a.document_id, a.type, a.text, a.page_number, a.embed_data,
    a.kind, a.created_at, a.updated_at,
    ar.data AS ai_data, ar.version AS ai_version,
    fc.data AS fsrs_data
  FROM annotations a
  LEFT JOIN ai_results ar ON ar.annotation_id = a.id AND ar.document_id = a.document_id
  LEFT JOIN fsrs_cards fc ON fc.annotation_id = a.id AND fc.document_id = a.document_id
`

// ── Handlers ─────────────────────────────────────────────────────────────

export function registerAnnotationHandlers() {
  ipcMain.handle("annotations:list", (_event, documentId: string) => {
    const sql = getSqlite()
    if (!sql) return []
    const rows = sql.prepare(`${LIST_ALL_SQL} WHERE a.document_id = ?`)
      .all(documentId) as AnnotationJoinedRow[]
    return rows.map(mapEnriched)
  })

  ipcMain.handle("annotations:listAll", () => {
    const sql = getSqlite()
    if (!sql) return []
    const rows = sql.prepare(LIST_ALL_SQL).all() as AnnotationJoinedRow[]
    return rows.map(mapEnriched)
  })

  ipcMain.handle("annotations:save", (_event, annotation: AnnotationEnrichedValue) => {
    const sql = getSqlite()
    if (!sql) return null
    const now = new Date().toISOString()
    sql.prepare(
      `INSERT OR REPLACE INTO annotations (id, document_id, type, text, page_number, embed_data, kind, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      annotation.id,
      annotation.document_id,
      annotation.type || "highlight",
      annotation.text || "",
      annotation.page_number ?? 0,
      annotation.embed_data || "",
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
      // Composite PK: use pipe-separated key for changelog
      recordDeletion(sql, "annotations", `${id}|${documentId}`)
      recordDeletion(sql, "ai_results", `${id}|${documentId}`)
      recordDeletion(sql, "fsrs_cards", `${id}|${documentId}`)
      sql.exec("COMMIT")
      invalidateReviewMetricsCache()
    } catch (err) {
      sql.exec("ROLLBACK")
      throw err
    }
  })
}
