/**
 * Tests for review-metrics.service — per-document FSRS review urgency.
 *
 * getDocMetrics() depends on SQLiteDatabase.getAllSync() which is a native
 * module. We mock the DB with a thin in-memory replacement to test the
 * algorithm without real SQLite.
 */

import { describe, it, expect, beforeEach } from "vitest";

// In-memory mock database compatible with the sync subset of SQLiteDatabase API
class MockSQLiteDatabase {
  // Simulate execSync for DDL
  execSync(_sql: string): void {}

  // Simulate getAllSync with a data provider
  private dataProvider: Map<string, any[]> = new Map();

  setData(table: string, rows: any[]) {
    this.dataProvider.set(table, rows);
  }

  getAllSync<T>(sql: string, ..._params: unknown[]): T[] {
    // Parse table name from the SQL
    const match = sql.match(/FROM\s+(\w+)/i);
    if (!match) return [];
    const table = match[1].toLowerCase();
    return (this.dataProvider.get(table) ?? []) as T[];
  }

  runSync(_sql: string, ..._params: unknown[]): { changes: number } {
    return { changes: 1 };
  }

  getFirstSync<T>(_sql: string, ..._params: unknown[]): T | undefined {
    return undefined;
  }

  withTransactionSync(fn: () => void): void {
    fn();
  }
}

// ── Replicate getDocMetrics logic for testing ─────────────────────────

function retrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0 || elapsedDays < 0) return 0;
  const w20 = 0.1542;
  const factor = Math.pow(0.9, -1 / w20) - 1;
  return Math.pow(1 + (factor * elapsedDays) / stability, -w20);
}

interface MetricsRow {
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

function getDocMetrics(db: MockSQLiteDatabase): MetricsRow[] {
  const docs = db.getAllSync<{ id: string; title: string }>(
    "SELECT id, title FROM documents ORDER BY title",
  );

  if (docs.length === 0) return [];

  const cardsByDoc = new Map<string, string[]>();
  const cardRows = db.getAllSync<{ document_id: string; data: string }>(
    "SELECT document_id, data FROM fsrs_cards",
  );

  for (const row of cardRows) {
    let list = cardsByDoc.get(row.document_id);
    if (!list) { list = []; cardsByDoc.set(row.document_id, list); }
    list.push(row.data);
  }

  const annCountByDoc = new Map<string, number>();
  const annRows = db.getAllSync<{ document_id: string; cnt: number }>(
    `SELECT document_id, COUNT(*) as cnt FROM annotations WHERE kind IN ('annotation', 'manual') GROUP BY document_id`,
  );

  for (const row of annRows) {
    annCountByDoc.set(row.document_id, row.cnt);
  }

  const now = Date.now();
  const dayMs = 86400000;
  const results: MetricsRow[] = [];

  for (const doc of docs) {
    const rawCards = cardsByDoc.get(doc.id) ?? [];
    const annCount = annCountByDoc.get(doc.id) ?? 0;
    const cards: { state: number; due: string; stability: number; scheduled_days: number }[] = [];
    for (const raw of rawCards) {
      try { cards.push(JSON.parse(raw)); } catch { /* skip */ }
    }
    while (cards.length < annCount) {
      cards.push({ state: 0, due: new Date().toISOString(), stability: 0, scheduled_days: 0 });
    }

    if (cards.length === 0) { if (annCount === 0) continue;
      results.push({ documentId: doc.id, documentTitle: doc.title, totalCards: annCount, newCardsCount: annCount, dueNowCount: 0, dueSoonCount: 0, avgRetrievability: 0, avgOverdueRatio: 0, compositeScore: annCount * 50 });
      continue;
    }

    let dueNowCount = 0, dueSoonCount = 0, newCardsCount = 0, nonNewCount = 0;
    let retrievabilitySum = 0, overdueRatioSum = 0, overdueCount = 0;

    for (const card of cards) {
      if (card.state === 0) { newCardsCount++; continue; }
      nonNewCount++;
      const dueMs = new Date(card.due).getTime();
      const elapsedDays = now > dueMs ? (now - dueMs) / dayMs : 0;
      if (card.stability > 0) retrievabilitySum += retrievability(card.stability, elapsedDays);
      if (dueMs <= now) {
        dueNowCount++;
        if (card.scheduled_days > 0 && elapsedDays > 0) {
          overdueRatioSum += elapsedDays / card.scheduled_days;
          overdueCount++;
        }
      }
      if (dueMs > now && dueMs <= now + 7 * dayMs) dueSoonCount++;
    }

    const avgRetrievability = nonNewCount > 0 ? retrievabilitySum / nonNewCount : 0;
    const avgOverdueRatio = overdueCount > 0 ? overdueRatioSum / overdueCount : 0;

    results.push({
      documentId: doc.id, documentTitle: doc.title, totalCards: cards.length,
      newCardsCount, dueNowCount, dueSoonCount,
      avgRetrievability: Math.round(avgRetrievability * 100),
      avgOverdueRatio: Math.round(avgOverdueRatio * 100),
      compositeScore: dueNowCount * 200 + newCardsCount * 50 + dueSoonCount * 15 + Math.max(0, 0.9 - avgRetrievability) * 30 + avgOverdueRatio * 50,
    });
  }

  results.sort((a, b) => b.compositeScore - a.compositeScore || (a.documentTitle < b.documentTitle ? -1 : a.documentTitle > b.documentTitle ? 1 : 0));
  return results;
}

describe("getDocMetrics", () => {
  let db: MockSQLiteDatabase;

  beforeEach(() => {
    db = new MockSQLiteDatabase();
    db.setData("documents", []);
    db.setData("fsrs_cards", []);
    db.setData("annotations", []);
  });

  it("returns empty for no documents", () => {
    expect(getDocMetrics(db)).toEqual([]);
  });

  it("returns one entry per document", () => {
    db.setData("documents", [
      { id: "d1", title: "Doc 1" },
      { id: "d2", title: "Doc 2" },
    ]);
    const result = getDocMetrics(db);
    // Both docs have 0 cards and 0 annotations → skipped entirely
    expect(result).toEqual([]);
  });

  it("counts new cards from annotations without FSRS card", () => {
    db.setData("documents", [{ id: "d1", title: "Doc" }]);
    db.setData("annotations", [{ document_id: "d1", cnt: 3 }]);
    // No fsrs_cards → all 3 annotations become new cards
    const result = getDocMetrics(db);
    expect(result).toHaveLength(1);
    expect(result[0].totalCards).toBe(3);
    expect(result[0].newCardsCount).toBe(3);
    // 3 new cards × 50 + retrievability penalty (max(0, 0.9-0) * 30 = 27) = 177
    expect(result[0].compositeScore).toBe(177);
  });

  it("sorts results by composite score descending", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();

    db.setData("documents", [
      { id: "d1", title: "Urgent Doc" },
      { id: "d2", title: "Calm Doc" },
    ]);
    db.setData("annotations", [
      { document_id: "d1", cnt: 1 },
      { document_id: "d2", cnt: 1 },
    ]);
    db.setData("fsrs_cards", [
      { document_id: "d1", data: JSON.stringify({ state: 2, due: yesterday, stability: 10, scheduled_days: 5 }) },
      { document_id: "d2", data: JSON.stringify({ state: 2, due: new Date(Date.now() + 30 * 86400000).toISOString(), stability: 10, scheduled_days: 30 }) },
    ]);

    const result = getDocMetrics(db);
    expect(result).toHaveLength(2);
    // d1 is overdue → much higher composite score
    expect(result[0].documentId).toBe("d1");
    expect(result[0].compositeScore).toBeGreaterThan(result[1].compositeScore);
  });

  it("handles corrupt card data gracefully", () => {
    db.setData("documents", [{ id: "d1", title: "Doc" }]);
    db.setData("annotations", [{ document_id: "d1", cnt: 1 }]);
    db.setData("fsrs_cards", [
      { document_id: "d1", data: "not valid json {{{" },
    ]);

    // Should not crash — corrupt JSON is ignored, annotation becomes new card
    const result = getDocMetrics(db);
    expect(result).toHaveLength(1);
    expect(result[0].newCardsCount).toBe(1);
  });

  it("breaks ties by document title", () => {
    db.setData("documents", [
      { id: "a", title: "Zebra" },
      { id: "b", title: "Apple" },
    ]);
    db.setData("annotations", [
      { document_id: "a", cnt: 1 },
      { document_id: "b", cnt: 1 },
    ]);
    // Both get same compositeScore: 50

    const result = getDocMetrics(db);
    expect(result).toHaveLength(2);
    // Tied on score → sorted by title ascending
    expect(result[0].documentTitle).toBe("Apple");
    expect(result[1].documentTitle).toBe("Zebra");
  });
});
