import { ipcMain } from "electron"
import { getSqlite } from "../database"

/**
 * Single batch IPC handler that returns all FSRS card data across all documents.
 *
 * Previously the renderer iterated over every document calling
 * fsrsCards.listByDocument() — O(N) IPC calls. This handler replaces
 * that with 3 SQL queries in one call (O(1) IPC).
 *
 * Returns:
 *   Record<string, { title: string; cardData: string[]; annotationIds: string[] }>
 *   keyed by documentId. Every document gets an entry; documents with no
 *   annotations get empty cards + annotationIds arrays.
 */
export function registerReviewHandlers() {
  ipcMain.handle("review:getAllCardsWithDocuments", () => {
    const sql = getSqlite()
    if (!sql) return {}

    // All documents
    const docs = sql
      .prepare("SELECT id, title FROM documents ORDER BY title")
      .all() as { id: string; title: string }[]

    // All FSRS cards (stringified JSON)
    const cards = sql
      .prepare("SELECT document_id, annotation_id, data FROM fsrs_cards")
      .all() as { document_id: string; annotation_id: string; data: string }[]

    // All annotations (just ids for counting cards with no card row)
    const annotations = sql
      .prepare("SELECT id, document_id FROM annotations")
      .all() as { id: string; document_id: string }[]

    // Build card lookup: document_id → card data strings
    const cardsByDoc = new Map<string, string[]>()
    for (const c of cards) {
      let list = cardsByDoc.get(c.document_id)
      if (!list) {
        list = []
        cardsByDoc.set(c.document_id, list)
      }
      list.push(c.data)
    }

    // Build annotation-id set per doc
    const annIdsByDoc = new Map<string, string[]>()
    for (const a of annotations) {
      let list = annIdsByDoc.get(a.document_id)
      if (!list) {
        list = []
        annIdsByDoc.set(a.document_id, list)
      }
      list.push(a.id)
    }

    const result: Record<string, { title: string; cardData: string[]; annotationIds: string[] }> = {}
    for (const doc of docs) {
      result[doc.id] = {
        title: doc.title,
        cardData: cardsByDoc.get(doc.id) ?? [],
        annotationIds: annIdsByDoc.get(doc.id) ?? [],
      }
    }
    return result
  })
}
