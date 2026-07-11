/**
 * Document-level FSRS metrics derived from individual annotation cards.
 *
 * The approach is inspired by SuperMemo's incremental reading priority queue:
 * an article/document's review urgency is determined by aggregating the FSRS
 * state of all its component cards.
 *
 * Ranking factors (weighted):
 * 1. due_now_count     — cards due at this moment (highest weight)
 * 2. avg_overdue_ratio — how far past-due cards are on average (elapsed/scheduled)
 * 3. avg_retrievability — average retrievability across all cards (lower = more urgent)
 * 4. due_soon_count    — cards due within the next 7 days
 * 5. total_cards       — tiebreaker (more annotated content = higher rank)
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
    let retrievabilitySum = 0
    let overdueRatioSum = 0
    let overdueCount = 0

    for (const card of cards) {
      // Count new cards (state === New) — annotated but not yet studied
      if (card.state === State.New) {
        newCardsCount++
        // Don't count new cards into retrievability metrics
        continue
      }

      // Normalize due date
      const due = card.due instanceof Date ? card.due : new Date(card.due)
      const dueMs = due.getTime()
      const elapsedDays = now > dueMs ? (now - dueMs) / dayMs : 0

      // Retrievability
      if (card.stability > 0) {
        retrievabilitySum += retrievability(card.stability, elapsedDays)
      }

      // Due now
      if (dueMs <= now) {
        dueNowCount++
        // Overdue ratio
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
    const avgRetrievability = total > 0 ? retrievabilitySum / total : 0
    const avgOverdueRatio = overdueCount > 0 ? overdueRatioSum / overdueCount : 0

    // Composite score: higher = more urgent
    // Weights: due_now * 100, due_soon * 10, new * 20, retrievability penalty, overdue bonus
    const retrievabilityPenalty = Math.max(0, 0.5 - avgRetrievability) * 50
    const overdueBonus = avgOverdueRatio * 20

    results.push({
      documentId: docId,
      documentTitle: title,
      totalCards: total,
      newCardsCount,
      dueNowCount,
      dueSoonCount,
      avgRetrievability: Math.round(avgRetrievability * 100),
      avgOverdueRatio: Math.round(avgOverdueRatio * 100),
      compositeScore: dueNowCount * 100 + dueSoonCount * 10 + newCardsCount * 20 + retrievabilityPenalty + overdueBonus,
    })
  }

  // Sort by composite score descending (most urgent first)
  results.sort((a, b) => b.compositeScore - a.compositeScore)

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
