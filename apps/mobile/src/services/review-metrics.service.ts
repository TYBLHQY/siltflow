/**
 * Review metrics service — per-document FSRS review urgency computation.
 *
 * Uses expo-sqlite native SQLiteDatabase for raw SQL queries.
 * Computed entirely in the service layer so stores only need one call.
 *
 * Mirrors the desktop IPC handler in `electron/ipc/review.ipc.ts`.
 */

import type { SQLiteDatabase } from "expo-sqlite";
import { retrievability } from "@siltflow/shared-lib";

type DB = SQLiteDatabase;

// ── Types ─────────────────────────────────────────────────────────────

interface FSRSCardState {
  state: number;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
}

interface DocRow {
  id: string;
  title: string;
}

interface CardRow {
  document_id: string;
  data: string;
}

interface CountRow {
  document_id: string;
  cnt: number;
}

export interface MetricsRow {
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

// ── Metrics computation ───────────────────────────────────────────────

/**
 * Compute per-document review urgency metrics.
 *
 * Equivalent to the desktop `review:getDocMetrics` IPC handler.
 * Fetches all documents, FSRS cards, and annotation counts in 3 queries,
 * then computes aggregated metrics for each document.
 */
export function getDocMetrics(db: DB): MetricsRow[] {
  // Fetch all documents
  const docs = db.getAllSync<DocRow>(
    "SELECT id, title FROM documents ORDER BY title",
  );

  if (docs.length === 0) return [];

  // Fetch all FSRS cards grouped by document
  const cardsByDoc = new Map<string, string[]>();
  const cardRows = db.getAllSync<CardRow>(
    "SELECT document_id, data FROM fsrs_cards",
  );

  for (const row of cardRows) {
    let list = cardsByDoc.get(row.document_id);
    if (!list) {
      list = [];
      cardsByDoc.set(row.document_id, list);
    }
    list.push(row.data);
  }

  // Count annotations per document (to catch annotations with no card row)
  const annCountByDoc = new Map<string, number>();
  const annRows = db.getAllSync<CountRow>(
    `SELECT document_id, COUNT(*) as cnt
     FROM annotations
     WHERE kind IN ('annotation', 'manual')
     GROUP BY document_id`,
  );

  for (const row of annRows) {
    annCountByDoc.set(row.document_id, row.cnt);
  }

  // ── Compute metrics per document ──────────────────────────────────
  const now = Date.now();
  const dayMs = 86400000;
  const results: MetricsRow[] = [];

  for (const doc of docs) {
    const rawCards = cardsByDoc.get(doc.id) ?? [];
    const annCount = annCountByDoc.get(doc.id) ?? 0;
    const cards: FSRSCardState[] = [];

    for (const raw of rawCards) {
      try {
        cards.push(JSON.parse(raw));
      } catch {
        /* skip corrupt data */
      }
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
      });
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
      if (card.state === 0) {
        // State.New
        newCardsCount++;
        continue;
      }
      nonNewCount++;
      const dueMs = new Date(card.due).getTime();
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

    const avgRetrievability =
      nonNewCount > 0 ? retrievabilitySum / nonNewCount : 0;
    const avgOverdueRatio =
      overdueCount > 0 ? overdueRatioSum / overdueCount : 0;

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
    });
  }

  // Sort: most urgent first, then by title
  results.sort(
    (a, b) =>
      b.compositeScore - a.compositeScore ||
      a.documentTitle.localeCompare(b.documentTitle),
  );

  return results;
}
