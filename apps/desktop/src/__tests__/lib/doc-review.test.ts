/**
 * Tests for computeDocMetrics and sortDocMetrics — document review ranking.
 */

import { describe, it, expect } from "vitest";
import { computeDocMetrics, sortDocMetrics } from "@/lib/doc-review";
import type { Card } from "ts-fsrs";
import { State } from "ts-fsrs";

// Helper: create a minimal Card with the fields computeDocMetrics reads
function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    due: new Date(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: State.New,
    last_review: undefined,
    ...overrides,
  } as Card;
}

describe("computeDocMetrics", () => {
  it("returns empty array for empty input", () => {
    expect(computeDocMetrics({})).toEqual([]);
  });

  it("handles documents with zero cards", () => {
    const result = computeDocMetrics({
      "doc-empty": { title: "Empty Doc", cards: [] },
    });
    expect(result).toHaveLength(1);
    expect(result[0].totalCards).toBe(0);
    expect(result[0].compositeScore).toBe(-1);
    expect(result[0].documentTitle).toBe("Empty Doc");
  });

  it("counts new cards correctly", () => {
    const result = computeDocMetrics({
      "doc-1": {
        title: "Test",
        cards: [makeCard({ state: State.New }), makeCard({ state: State.New })],
      },
    });
    expect(result[0].newCardsCount).toBe(2);
    expect(result[0].totalCards).toBe(2);
  });

  it("counts due-now cards (past their due date)", () => {
    const pastDue = new Date(Date.now() - 86400000); // yesterday
    const result = computeDocMetrics({
      "doc-1": {
        title: "Overdue Doc",
        cards: [
          makeCard({ state: State.Review, due: pastDue, stability: 10, scheduled_days: 5 }),
        ],
      },
    });
    expect(result[0].dueNowCount).toBe(1);
  });

  it("counts future-due cards within 7 days", () => {
    const in3Days = new Date(Date.now() + 3 * 86400000);
    const result = computeDocMetrics({
      "doc-1": {
        title: "Soon Doc",
        cards: [
          makeCard({ state: State.Review, due: in3Days, stability: 10 }),
        ],
      },
    });
    expect(result[0].dueSoonCount).toBe(1);
  });

  it("does not count cards due more than 7 days out", () => {
    const in30Days = new Date(Date.now() + 30 * 86400000);
    const result = computeDocMetrics({
      "doc-1": {
        title: "Far Doc",
        cards: [
          makeCard({ state: State.Review, due: in30Days, stability: 10 }),
        ],
      },
    });
    expect(result[0].dueSoonCount).toBe(0);
  });

  it("higher composite score = more urgent", () => {
    const past = new Date(Date.now() - 10 * 86400000);
    const future = new Date(Date.now() + 10 * 86400000);

    // Doc A: many overdue cards → high urgency
    // Doc B: all future → low urgency
    const result = computeDocMetrics({
      "doc-urgent": {
        title: "Urgent",
        cards: Array.from({ length: 5 }, () =>
          makeCard({ state: State.Review, due: past, stability: 10, scheduled_days: 3 }),
        ),
      },
      "doc-chill": {
        title: "Chill",
        cards: Array.from({ length: 5 }, () =>
          makeCard({ state: State.Review, due: future, stability: 10 }),
        ),
      },
    });

    // Sorted by compositeScore descending, so urgent doc should be first
    expect(result[0].documentId).toBe("doc-urgent");
    expect(result[0].compositeScore).toBeGreaterThan(result[1].compositeScore);
  });

  it("sorts by title when scores are equal", () => {
    const result = computeDocMetrics({
      "b-doc": { title: "B Doc", cards: [] },
      "a-doc": { title: "A Doc", cards: [] },
    });
    expect(result[0].documentTitle).toBe("A Doc");
    expect(result[1].documentTitle).toBe("B Doc");
  });
});

describe("sortDocMetrics", () => {
  const metrics = [
    { documentId: "1", documentTitle: "A", totalCards: 5, newCardsCount: 3, dueNowCount: 1, dueSoonCount: 0, avgRetrievability: 90, avgOverdueRatio: 0, compositeScore: 350 },
    { documentId: "2", documentTitle: "B", totalCards: 3, newCardsCount: 0, dueNowCount: 5, dueSoonCount: 0, avgRetrievability: 50, avgOverdueRatio: 50, compositeScore: 1000 },
    { documentId: "3", documentTitle: "C", totalCards: 10, newCardsCount: 0, dueNowCount: 0, dueSoonCount: 10, avgRetrievability: 80, avgOverdueRatio: 0, compositeScore: 150 },
  ];

  it('sorts by "new" (newCardsCount descending, ties broken by dueNow)', () => {
    const sorted = sortDocMetrics(metrics, "new");
    // Doc 1 has 3 new cards, docs 2 and 3 have 0
    expect(sorted[0].documentId).toBe("1");
  });

  it('sorts by "due" (dueNowCount descending)', () => {
    const sorted = sortDocMetrics(metrics, "due");
    // Doc 2 has 5 dueNow, doc 1 has 1
    expect(sorted[0].documentId).toBe("2");
  });

  it('sorts by "soon" (dueSoonCount descending)', () => {
    const sorted = sortDocMetrics(metrics, "soon");
    // Doc 3 has 10 dueSoon
    expect(sorted[0].documentId).toBe("3");
  });

  it('sorts by "urgency" (compositeScore descending)', () => {
    const sorted = sortDocMetrics(metrics, "urgency");
    expect(sorted[0].compositeScore).toBe(1000);
    expect(sorted[1].compositeScore).toBe(350);
    expect(sorted[2].compositeScore).toBe(150);
  });

  it("returns a new array (does not mutate input)", () => {
    const copy = [...metrics];
    sortDocMetrics(metrics, "urgency");
    expect(metrics).toEqual(copy);
  });
});
