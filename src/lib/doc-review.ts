/**
 * Document-level FSRS metrics derived from individual annotation cards.
 *
 * The approach is inspired by SuperMemo's incremental reading priority queue:
 * an article/document's review urgency is determined by aggregating the FSRS
 * state of all its component cards.
 *
 * Ranking factors (weighted):
 * 1. due_now_count     — cards due at this moment (highest weight ×200)
 * 2. new_cards_count   — annotated but not yet studied (×50)
 * 3. due_soon_count    — cards due within the next 7 days (×15)
 * 4. overdue_depth     — how far past-due cards are on average (elapsed/scheduled)
 * 5. avg_retrievability — average retrievability of non-new cards (lower = more urgent)
 */
import type { Card } from "ts-fsrs"
import { State } from "ts-fsrs"

export interface CardWithDoc {
  card: Card
  documentId: string
}

export interface DocReviewMetrics {
  documentId: string
  documentTitle: string
  totalCards: number
  newCardsCount: number
  dueNowCount: number
  dueSoonCount: number // within 7 days
  avgRetrievability: number
  avgOverdueRatio: number
  compositeScore: number
}

/**
 * Compute retrievability from FSRS card state.
 * Default w[20] = 0.1542 (FSRS-5) — a reasonable approximation.
 */
function retrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0 || elapsedDays < 0) return 0
  const w20 = 0.1542
  const factor = Math.pow(0.9, -1 / w20) - 1
  return Math.pow(1 + factor * elapsedDays / stability, -w20)
}

/**
 * Build per-document review metrics from all annotations' FSRS cards.
 */
export function computeDocMetrics(
  annotationsByDoc: Record<string, { title: string; cards: Card[] }>,
): DocReviewMetrics[] {
  const now = Date.now()
  const dayMs = 86400000
  const results: DocReviewMetrics[] = []

  for (const [docId, { title, cards }] of Object.entries(annotationsByDoc)) {
    if (cards.length === 0) {
      results.push({
        documentId: docId,
        documentTitle: title,
        totalCards: 0,
        newCardsCount: 0,
        dueNowCount: 0,
        dueSoonCount: 0,
        avgRetrievability: 0,
        avgOverdueRatio: 0,
        compositeScore: -1, // no cards → lowest priority
      })
      continue
    }

    let dueNowCount = 0
    let dueSoonCount = 0
    let newCardsCount = 0
    let nonNewCount = 0
    let retrievabilitySum = 0
    let overdueRatioSum = 0
    let overdueCount = 0

    for (const card of cards) {
      // Count new cards (state === New) — annotated but not yet studied
      if (card.state === State.New) {
        newCardsCount++
        continue
      }

      nonNewCount++

      // Normalize due date
      const due = card.due instanceof Date ? card.due : new Date(card.due)
      const dueMs = due.getTime()
      const elapsedDays = now > dueMs ? (now - dueMs) / dayMs : 0

      // Retrievability (only for non-new cards)
      if (card.stability > 0) {
        retrievabilitySum += retrievability(card.stability, elapsedDays)
      }

      // Due now — include overdue depth
      if (dueMs <= now) {
        dueNowCount++
        if (card.scheduled_days > 0 && elapsedDays > 0) {
          overdueRatioSum += elapsedDays / card.scheduled_days
          overdueCount++
        }
      }

      // Due within 7 days
      if (dueMs > now && dueMs <= now + 7 * dayMs) {
        dueSoonCount++
      }
    }

    const total = cards.length
    const avgRetrievability = nonNewCount > 0 ? retrievabilitySum / nonNewCount : 0
    const avgOverdueRatio = overdueCount > 0 ? overdueRatioSum / overdueCount : 0

    // Composite score: higher = more urgent
    // Weights: due_now ×200, new ×50, due_soon ×15
    // Overdue depth: each day overdue beyond scheduled boosts score
    // Retrievability penalty: only matters when avgR drops below 90%
    const overdueDepthPenalty = avgOverdueRatio * 50
    const retrievabilityPenalty = Math.max(0, 0.9 - avgRetrievability) * 30

    results.push({
      documentId: docId,
      documentTitle: title,
      totalCards: total,
      newCardsCount,
      dueNowCount,
      dueSoonCount,
      avgRetrievability: Math.round(avgRetrievability * 100),
      avgOverdueRatio: Math.round(avgOverdueRatio * 100),
      compositeScore: dueNowCount * 200 + newCardsCount * 50 + dueSoonCount * 15 + retrievabilityPenalty + overdueDepthPenalty,
    })
  }

  // Sort by composite score descending (most urgent first), then by title for stability
  results.sort((a, b) => b.compositeScore - a.compositeScore || a.documentTitle.localeCompare(b.documentTitle))

  return results
}

/**
 * Label for retrieval urgency.
 */
export function urgencyLabel(avgRetrievability: number): string {
  if (avgRetrievability >= 90) return "Fresh"
  if (avgRetrievability >= 75) return "Good"
  if (avgRetrievability >= 50) return "Aging"
  return "Stale"
}
