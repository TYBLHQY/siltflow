/**
 * Document-level FSRS metrics derived from individual annotation cards.
 */
import type { Card } from "ts-fsrs";
import { State } from "ts-fsrs";

export interface CardWithDoc {
  card: Card;
  documentId: string;
}

export interface DocReviewMetrics {
  documentId: string;
  documentTitle: string;
  totalCards: number;
  newCardsCount: number;
  dueNowCount: number;
  dueSoonCount: number;
  avgRetrievability: number;
  avgOverdueRatio: number;
  compositeScore: number;
}

export function retrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0 || elapsedDays < 0) return 0;
  const w20 = 0.1542;
  const factor = Math.pow(0.9, -1 / w20) - 1;
  return Math.pow(1 + (factor * elapsedDays) / stability, -w20);
}

export function computeDocMetrics(
  annotationsByDoc: Record<string, { title: string; cards: Card[] }>,
): DocReviewMetrics[] {
  const now = Date.now();
  const dayMs = 86400000;
  const results: DocReviewMetrics[] = [];

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
        compositeScore: -1,
      });
      continue;
    }

    let dueNowCount = 0;
    let dueSoonCount = 0;
    let newCardsCount = 0;
    let nonNewCount = 0;
    let retrievabilitySum = 0;
    let overdueRatioSum = 0;
    let overdueCount = 0;

    for (const card of cards) {
      if (card.state === State.New) {
        newCardsCount++;
        continue;
      }

      nonNewCount++;

      const due = card.due instanceof Date ? card.due : new Date(card.due);
      const dueMs = due.getTime();
      const elapsedDays = now > dueMs ? (now - dueMs) / dayMs : 0;

      if (card.stability > 0) {
        retrievabilitySum += retrievability(card.stability, elapsedDays);
      }

      if (dueMs <= now) {
        dueNowCount++;
        if (card.scheduled_days > 0 && elapsedDays > 0) {
          overdueRatioSum += elapsedDays / card.scheduled_days;
          overdueCount++;
        }
      }

      if (dueMs > now && dueMs <= now + 7 * dayMs) {
        dueSoonCount++;
      }
    }

    const total = cards.length;
    const avgRetrievability =
      nonNewCount > 0 ? retrievabilitySum / nonNewCount : 0;
    const avgOverdueRatio =
      overdueCount > 0 ? overdueRatioSum / overdueCount : 0;

    const overdueDepthPenalty = avgOverdueRatio * 50;
    const retrievabilityPenalty = Math.max(0, 0.9 - avgRetrievability) * 30;

    results.push({
      documentId: docId,
      documentTitle: title,
      totalCards: total,
      newCardsCount,
      dueNowCount,
      dueSoonCount,
      avgRetrievability: Math.round(avgRetrievability * 100),
      avgOverdueRatio: Math.round(avgOverdueRatio * 100),
      compositeScore:
        dueNowCount * 200 +
        newCardsCount * 50 +
        dueSoonCount * 15 +
        retrievabilityPenalty +
        overdueDepthPenalty,
    });
  }

  results.sort(
    (a, b) =>
      b.compositeScore - a.compositeScore ||
      a.documentTitle.localeCompare(b.documentTitle),
  );

  return results;
}

export function urgencyLabel(avgRetrievability: number): string {
  if (avgRetrievability >= 90) return "Fresh";
  if (avgRetrievability >= 75) return "Good";
  if (avgRetrievability >= 50) return "Aging";
  return "Stale";
}
