import { ipcMain } from "electron"
import { getSqlite } from "../database"

/**
 * Compute retrievability from FSRS card state (FSRS-5).
 * Duplicated from src/lib/doc-review.ts because the main process
 * can't use the @ path alias.
 */
function retrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0 || elapsedDays < 0) return 0
  const w20 = 0.1542
  const factor = Math.pow(0.9, -1 / w20) - 1
  return Math.pow(1 + (factor * elapsedDays) / stability, -w20)
}

interface FSRSCard {
  state: number
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
}

// ── In-memory cache for review metrics ─────────────────────────────
// Invalidated whenever annotations or fsrs_cards are mutated.
let metricsCache: { data: MetricsRow[]; version: number } | null = null
let dataVersion = 0

/** Call this from annotation/fsrs-card IPC handlers when data changes. */
export function invalidateReviewMetricsCache() {
  dataVersion++
  metricsCache = null
}
// ───────────────────────────────────────────────────────────────────

/**
 * Single batch IPC handler that returns pre-computed DocReviewMetrics
 * for every document — computed entirely in the main process so the
 * renderer only has to setState.
 *
 * Previously: O(N) IPC calls + renderer-side JSON.parse + computation.
 * Now:        O(1) IPC call, all work in the main process.
 */
export function registerReviewHandlers() {
  ipcMain.handle("review:getDocMetrics", () => {
    const sql = getSqlite()
    if (!sql) return []

    // Return cached result if still fresh
    if (metricsCache) {
      return metricsCache.data
    }

    const docs = sql
      .prepare("SELECT id, title FROM documents ORDER BY title")
      .all() as { id: string; title: string }[]

    if (docs.length === 0) return []

    // Count cards per document (annotation_id → data)
    const cardsByDoc = new Map<string, string[]>()
    const cardRows = sql
      .prepare("SELECT document_id, data FROM fsrs_cards")
      .all() as { document_id: string; data: string }[]

    for (const row of cardRows) {
      let list = cardsByDoc.get(row.document_id)
      if (!list) {
        list = []
        cardsByDoc.set(row.document_id, list)
      }
      list.push(row.data)
    }

    // Count annotations per document (to catch annotations with no card row)
    const annCountByDoc = new Map<string, number>()
    const annRows = sql
      .prepare("SELECT document_id, COUNT(*) as cnt FROM annotations GROUP BY document_id")
      .all() as { document_id: string; cnt: number }[]

    for (const row of annRows) {
      annCountByDoc.set(row.document_id, row.cnt)
    }

    // ── Compute metrics per document ──────────────────────────────
    const now = Date.now()
    const dayMs = 86400000
    const results: MetricsRow[] = []

    for (const doc of docs) {
      const rawCards = cardsByDoc.get(doc.id) ?? []
      const annCount = annCountByDoc.get(doc.id) ?? 0
      const cards: FSRSCard[] = []

      for (const raw of rawCards) {
        try {
          cards.push(JSON.parse(raw))
        } catch { /* skip corrupt data */ }
      }

      // Annotations without an FSRS card → treat as New state
      while (cards.length < annCount) {
        cards.push({
          state: 0, // State.New
          due: new Date().toISOString(),
          stability: 0,
          difficulty: 0,
          elapsed_days: 0,
          scheduled_days: 0,
          reps: 0,
          lapses: 0,
        })
      }

      if (cards.length === 0) {
        results.push({
          documentId: doc.id,
          documentTitle: doc.title,
          totalCards: 0,
          newCardsCount: 0,
          dueNowCount: 0,
          dueSoonCount: 0,
          avgRetrievability: 0,
          avgOverdueRatio: 0,
          compositeScore: -1,
        })
        continue
      }

      let dueNowCount = 0, dueSoonCount = 0, newCardsCount = 0
      let nonNewCount = 0, retrievabilitySum = 0, overdueRatioSum = 0, overdueCount = 0

      for (const card of cards) {
        if (card.state === 0) { // State.New
          newCardsCount++
          continue
        }
        nonNewCount++
        const dueMs = new Date(card.due).getTime()
        const elapsedDays = now > dueMs ? (now - dueMs) / dayMs : 0

        if (card.stability > 0) {
          retrievabilitySum += retrievability(card.stability, elapsedDays)
        }
        if (dueMs <= now) {
          dueNowCount++
          if (card.scheduled_days > 0 && elapsedDays > 0) {
            overdueRatioSum += elapsedDays / card.scheduled_days
            overdueCount++
          }
        }
        if (dueMs > now && dueMs <= now + 7 * dayMs) {
          dueSoonCount++
        }
      }

      const avgRetrievability = nonNewCount > 0 ? retrievabilitySum / nonNewCount : 0
      const avgOverdueRatio = overdueCount > 0 ? overdueRatioSum / overdueCount : 0

      results.push({
        documentId: doc.id,
        documentTitle: doc.title,
        totalCards: cards.length,
        newCardsCount,
        dueNowCount,
        dueSoonCount,
        avgRetrievability: Math.round(avgRetrievability * 100),
        avgOverdueRatio: Math.round(avgOverdueRatio * 100),
        compositeScore:
          dueNowCount * 200 +
          newCardsCount * 50 +
          dueSoonCount * 15 +
          Math.max(0, 0.9 - avgRetrievability) * 30 +
          avgOverdueRatio * 50,
      })
    }

    // Sort: most urgent first, then by title
    results.sort((a, b) =>
      b.compositeScore - a.compositeScore ||
      a.documentTitle.localeCompare(b.documentTitle),
    )

    // Cache the result until invalidation
    metricsCache = { data: results, version: dataVersion }

    return results
  })
}

interface MetricsRow {
  documentId: string
  documentTitle: string
  totalCards: number
  newCardsCount: number
  dueNowCount: number
  dueSoonCount: number
  avgRetrievability: number
  avgOverdueRatio: number
  compositeScore: number
}
