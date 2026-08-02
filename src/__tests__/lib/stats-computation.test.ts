import { describe, it, expect, afterEach, vi } from "vitest";
import { createEmptyCard, State, type Card } from "ts-fsrs";
import {
  computeDailyReviews,
  computeCalendarHeatmap,
  computeGradeDistribution,
  computeStabilityHistogram,
  computeRetrievabilityHistogram,
  computeDifficultyHistogram,
  computeIntervalHistogram,
  computeKnowledgeGrowth,
  computeReviewForecast,
  computeForgettingCurves,
  computeRetentionTradeoff,
  computeOverviewStats,
  FORGETTING_LABELS,
} from "@/lib/stats-computation";
import type { ReviewLogData } from "@/lib/fsrs-utils";

// ── Fixtures ───────────────────────────────────────────────────────────

/** Full valid Card seeded from ts-fsrs, with any fields overridden. */
function makeCard(overrides: Partial<Card> = {}): Card {
  return { ...createEmptyCard(new Date(2026, 5, 1)), ...overrides };
}

/** Serialized review_log `data` JSON matching parseReviewLogData's shape. */
function reviewLogData(opts: {
  grade?: number;
  state?: number;
  stability?: number;
  scheduledDays?: number;
} = {}): string {
  const { grade = 3, state = 2, stability = 30, scheduledDays = 10 } = opts;
  const parsed: ReviewLogData = {
    grade,
    log: {
      rating: grade,
      state,
      due: "2026-06-01T00:00:00.000Z",
      stability,
      difficulty: 5,
      scheduled_days: scheduledDays,
      learning_steps: 0,
      review: "2026-06-01T00:00:00.000Z",
    },
    card: {
      due: "2026-06-11T00:00:00.000Z",
      stability,
      difficulty: 5,
      scheduled_days: scheduledDays,
      learning_steps: 0,
      reps: 1,
      lapses: 0,
      state,
    },
  };
  return JSON.stringify(parsed);
}

/** A review-log row as consumed by the chart computations. */
function log(createdAt: string, data: string) {
  return { createdAt, data };
}

/** Like log, but with a required annotationId for computeKnowledgeGrowth. */
function growthLog(
  createdAt: string,
  data: string,
  annotationId: string,
) {
  return { createdAt, data, annotationId };
}

const LEARN = reviewLogData({ state: 1 });
const REVIEW = reviewLogData({ state: 2 });

afterEach(() => {
  vi.useRealTimers();
});

// ── computeDailyReviews ────────────────────────────────────────────────

describe("computeDailyReviews", () => {
  it("returns an empty array for no logs", () => {
    expect(computeDailyReviews([])).toEqual([]);
  });

  it("groups logs by date and splits review (state 2) vs learn", () => {
    const result = computeDailyReviews([
      log("2026-06-01T10:00:00.000Z", REVIEW),
      log("2026-06-01T11:00:00.000Z", LEARN),
    ]);
    expect(result).toEqual([
      { date: "2026-06-01", count: 2, learnCount: 1, reviewCount: 1 },
    ]);
  });

  it("sorts output by date regardless of input order", () => {
    const result = computeDailyReviews([
      log("2026-06-03T10:00:00.000Z", REVIEW),
      log("2026-06-01T10:00:00.000Z", REVIEW),
      log("2026-06-02T10:00:00.000Z", LEARN),
    ]);
    expect(result.map((r) => r.date)).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ]);
    expect(result[1]).toEqual({
      date: "2026-06-02",
      count: 1,
      learnCount: 1,
      reviewCount: 0,
    });
  });

  it("skips rows whose data fails to parse", () => {
    const result = computeDailyReviews([
      log("2026-06-01T10:00:00.000Z", REVIEW),
      log("2026-06-01T11:00:00.000Z", "{not json"),
    ]);
    expect(result).toEqual([
      { date: "2026-06-01", count: 1, learnCount: 0, reviewCount: 1 },
    ]);
  });

  it("drops rows older than the days cutoff", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z")); // cutoff = 2026-06-08

    const result = computeDailyReviews(
      [
        log("2026-06-07T10:00:00.000Z", REVIEW), // before cutoff → dropped
        log("2026-06-08T10:00:00.000Z", LEARN), // boundary → kept
        log("2026-06-15T10:00:00.000Z", REVIEW),
      ],
      7,
    );
    expect(result.map((r) => r.date)).toEqual(["2026-06-08", "2026-06-15"]);
  });
});

// ── computeCalendarHeatmap ─────────────────────────────────────────────

describe("computeCalendarHeatmap", () => {
  it("returns an empty map for no logs", () => {
    expect(computeCalendarHeatmap([]).size).toBe(0);
  });

  it("counts every log by date prefix, aggregating same-day entries", () => {
    const map = computeCalendarHeatmap([
      { createdAt: "2026-06-01T10:00:00.000Z" },
      { createdAt: "2026-06-01T11:30:00.000Z" },
      { createdAt: "2026-06-02T09:00:00.000Z" },
    ]);
    expect(map.get("2026-06-01")).toBe(2);
    expect(map.get("2026-06-02")).toBe(1);
    expect(map.size).toBe(2);
  });
});

// ── computeGradeDistribution ───────────────────────────────────────────

describe("computeGradeDistribution", () => {
  it("returns 4 zeroed items in order for empty input", () => {
    const result = computeGradeDistribution([]);
    expect(result.map((r) => r.name)).toEqual([
      "Again",
      "Hard",
      "Good",
      "Easy",
    ]);
    expect(result.every((r) => r.value === 0)).toBe(true);
  });

  it("counts grades 1-4 with their labels/colors, ignoring out-of-range", () => {
    const result = computeGradeDistribution([
      log("2026-06-01T10:00:00.000Z", reviewLogData({ grade: 1 })),
      log("2026-06-01T11:00:00.000Z", reviewLogData({ grade: 2 })),
      log("2026-06-01T12:00:00.000Z", reviewLogData({ grade: 3 })),
      log("2026-06-01T13:00:00.000Z", reviewLogData({ grade: 3 })),
      log("2026-06-01T14:00:00.000Z", reviewLogData({ grade: 4 })),
      log("2026-06-01T15:00:00.000Z", reviewLogData({ grade: 0 })), // ignored
      log("2026-06-01T16:00:00.000Z", reviewLogData({ grade: 5 })), // ignored
    ]);
    expect(result.map((r) => r.value)).toEqual([1, 1, 2, 1]);
  });

  it("assigns GRADE_COLOR values to each grade", () => {
    const result = computeGradeDistribution([
      log("2026-06-01T10:00:00.000Z", reviewLogData({ grade: 4 })),
    ]);
    expect(result[3].color).toBe("var(--catppuccin-color-blue)");
  });
});

// ── computeStabilityHistogram ──────────────────────────────────────────

describe("computeStabilityHistogram", () => {
  const labels = ["<1d", "1–7d", "7–30d", "30–90d", "90–365d", ">1y"];

  it("keeps all 6 bins present when empty", () => {
    const result = computeStabilityHistogram([]);
    expect(result.map((b) => b.label)).toEqual(labels);
    expect(result.every((b) => b.count === 0)).toBe(true);
  });

  it("buckets stability across all bins and skips New cards", () => {
    const result = computeStabilityHistogram([
      makeCard({ state: State.New, stability: 30 }), // skipped
      makeCard({ state: State.Review, stability: 0.5 }),
      makeCard({ state: State.Review, stability: 3 }),
      makeCard({ state: State.Review, stability: 10 }),
      makeCard({ state: State.Review, stability: 60 }),
      makeCard({ state: State.Review, stability: 200 }),
      makeCard({ state: State.Review, stability: 500 }),
    ]);
    expect(result.map((b) => b.count)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("treats bin boundaries inclusively on the low side (365 → >1y)", () => {
    const result = computeStabilityHistogram([
      makeCard({ state: State.Review, stability: 1 }), // → "1–7d"
      makeCard({ state: State.Review, stability: 7 }), // → "7–30d"
      makeCard({ state: State.Review, stability: 30 }), // → "30–90d"
      makeCard({ state: State.Review, stability: 90 }), // → "90–365d"
      makeCard({ state: State.Review, stability: 365 }), // → ">1y"
    ]);
    expect(result.map((b) => b.count)).toEqual([0, 1, 1, 1, 1, 1]);
  });
});

// ── computeRetrievabilityHistogram ─────────────────────────────────────

describe("computeRetrievabilityHistogram", () => {
  it("keeps 10 bins labeled 0-10% through 90-100%", () => {
    const result = computeRetrievabilityHistogram([]);
    expect(result.map((b) => b.label)).toEqual([
      "0–10%",
      "10–20%",
      "20–30%",
      "30–40%",
      "40–50%",
      "50–60%",
      "60–70%",
      "70–80%",
      "80–90%",
      "90–100%",
    ]);
  });

  it("treats a missing last_review as freshly reviewed (bin 90-100%)", () => {
    const result = computeRetrievabilityHistogram([
      makeCard({ state: State.Review, stability: 30 }),
    ]);
    expect(result[9].count).toBe(1);
  });

  it("computes elapsed from last_review — Date and ISO string match", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00Z"));

    const thirtyDaysAgo = "2026-05-16T00:00:00.000Z";
    const fromDate = computeRetrievabilityHistogram([
      makeCard({
        state: State.Review,
        stability: 1,
        last_review: new Date(thirtyDaysAgo),
      }),
    ]);
    const fromString = computeRetrievabilityHistogram([
      makeCard({
        state: State.Review,
        stability: 1,
        last_review: thirtyDaysAgo as unknown as Date,
      }),
    ]);

    // stability 1, elapsed 30d → r ≈ 0.59 → bin 5 (50-60%)
    expect(fromDate[5].count).toBe(1);
    expect(fromString.map((b) => b.count)).toEqual(
      fromDate.map((b) => b.count),
    );
  });

  it("skips New cards entirely", () => {
    const result = computeRetrievabilityHistogram([
      makeCard({ state: State.New }),
    ]);
    expect(result.every((b) => b.count === 0)).toBe(true);
  });
});

// ── computeDifficultyHistogram ─────────────────────────────────────────

describe("computeDifficultyHistogram", () => {
  it("buckets difficulty across 10 bins, clamping d=10 to the last bin", () => {
    const result = computeDifficultyHistogram([
      makeCard({ state: State.Review, difficulty: 1 }), // bin 0
      makeCard({ state: State.Review, difficulty: 5.5 }), // floor((4.5/9)*10)=5
      makeCard({ state: State.Review, difficulty: 10 }), // clamps to bin 9
    ]);
    expect(result[0].count).toBe(1);
    expect(result[5].count).toBe(1);
    expect(result[9].count).toBe(1);
    expect(result[0].label).toBe("1.0–1.9");
  });

  it("does not crash for difficulty < 1 (clamps into bin 0)", () => {
    const result = computeDifficultyHistogram([
      makeCard({ state: State.Review, difficulty: 0.5 }),
    ]);
    expect(result[0].count).toBe(1);
  });

  it("skips New cards", () => {
    const result = computeDifficultyHistogram([
      makeCard({ state: State.New, difficulty: 5 }),
    ]);
    expect(result.every((b) => b.count === 0)).toBe(true);
  });
});

// ── computeIntervalHistogram ───────────────────────────────────────────

describe("computeIntervalHistogram", () => {
  const labels = ["<1d", "1–7d", "7–30d", "30–90d", "90–365d", ">1y"];

  it("buckets scheduled_days using the same 6-bin scheme as stability", () => {
    const result = computeIntervalHistogram([
      makeCard({ state: State.Review, scheduled_days: 0.5 }),
      makeCard({ state: State.Review, scheduled_days: 3 }),
      makeCard({ state: State.Review, scheduled_days: 10 }),
      makeCard({ state: State.Review, scheduled_days: 60 }),
      makeCard({ state: State.Review, scheduled_days: 200 }),
      makeCard({ state: State.Review, scheduled_days: 500 }),
    ]);
    expect(result.map((b) => b.label)).toEqual(labels);
    expect(result.map((b) => b.count)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("skips New cards", () => {
    const result = computeIntervalHistogram([
      makeCard({ state: State.New, scheduled_days: 10 }),
    ]);
    expect(result.every((b) => b.count === 0)).toBe(true);
  });
});

// ── computeKnowledgeGrowth ─────────────────────────────────────────────

describe("computeKnowledgeGrowth", () => {
  it("returns an empty array for no logs", () => {
    expect(computeKnowledgeGrowth([])).toEqual([]);
  });

  it("counts a first-seen learning card (state 1) into the learning bucket", () => {
    const result = computeKnowledgeGrowth([
      growthLog("2026-06-01T10:00:00.000Z", reviewLogData({ state: 1 }), "a1"),
    ]);
    expect(result).toEqual([
      { date: "2026-06-01", learning: 1, young: 0, mature: 0, longTerm: 0 },
    ]);
  });

  it("buckets review cards by stability (young / mature / longTerm)", () => {
    const result = computeKnowledgeGrowth([
      growthLog("2026-06-01T10:00:00.000Z", reviewLogData({ state: 2, stability: 5 }), "a1"), // young
      growthLog("2026-06-01T11:00:00.000Z", reviewLogData({ state: 2, stability: 100 }), "a2"), // mature
      growthLog("2026-06-01T12:00:00.000Z", reviewLogData({ state: 2, stability: 500 }), "a3"), // longTerm
    ]);
    expect(result).toEqual([
      { date: "2026-06-01", learning: 0, young: 1, mature: 1, longTerm: 1 },
    ]);
  });

  it("migrates a card between buckets across dates", () => {
    const result = computeKnowledgeGrowth([
      growthLog("2026-06-01T10:00:00.000Z", reviewLogData({ state: 1 }), "a1"),
      growthLog("2026-06-02T10:00:00.000Z", reviewLogData({ state: 2, stability: 5 }), "a1"),
    ]);
    expect(result).toEqual([
      { date: "2026-06-01", learning: 1, young: 0, mature: 0, longTerm: 0 },
      { date: "2026-06-02", learning: 0, young: 1, mature: 0, longTerm: 0 },
    ]);
  });

  it("sorts output by date regardless of input order", () => {
    const result = computeKnowledgeGrowth([
      growthLog("2026-06-02T10:00:00.000Z", reviewLogData({ state: 1 }), "a1"),
      growthLog("2026-06-01T10:00:00.000Z", reviewLogData({ state: 1 }), "a2"),
    ]);
    expect(result.map((r) => r.date)).toEqual(["2026-06-01", "2026-06-02"]);
  });
});

// ── computeReviewForecast ──────────────────────────────────────────────

describe("computeReviewForecast", () => {
  it("returns exactly `days` entries starting tomorrow (local timezone)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 23, 30, 0)); // local Jun 15 23:30

    const result = computeReviewForecast([], 14);
    expect(result).toHaveLength(14);
    expect(result[0]).toEqual({ date: "2026-06-16", dueCount: 0 });
    expect(result[13]).toEqual({ date: "2026-06-29", dueCount: 0 });
  });

  it("counts a card due within the window on its exact date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 23, 30, 0));

    const result = computeReviewForecast(
      [
        // Due tomorrow (Jun 16) — counted.
        makeCard({
          state: State.Review,
          due: new Date(2026, 5, 16, 8, 0, 0),
        }),
        // Due today (Jun 15) — before window start — excluded.
        makeCard({
          state: State.Review,
          due: new Date(2026, 5, 15, 8, 0, 0),
        }),
        // Due past the 14-day window (Jun 30) — excluded.
        makeCard({
          state: State.Review,
          due: new Date(2026, 5, 30, 8, 0, 0),
        }),
        // New card — always skipped.
        makeCard({ state: State.New, due: new Date(2026, 5, 16, 8, 0, 0) }),
      ],
      14,
    );
    expect(result[0].dueCount).toBe(1);
    expect(result[1].dueCount).toBe(0);
  });

  it("accepts a due date serialized as an ISO string", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 23, 30, 0));

    const iso = new Date(2026, 5, 16, 8, 0, 0).toISOString();
    const result = computeReviewForecast(
      [
        makeCard({
          state: State.Review,
          due: iso as unknown as Date,
        }),
      ],
      14,
    );
    expect(result[0].dueCount).toBe(1);
  });
});

// ── computeForgettingCurves ────────────────────────────────────────────

describe("computeForgettingCurves", () => {
  it("returns 366 points with all 5 stability labels, ~1.0 at day 0", () => {
    const result = computeForgettingCurves();
    expect(result).toHaveLength(366);
    expect(result[0].day).toBe(0);
    for (const label of FORGETTING_LABELS) {
      expect(result[0][label]).toBeCloseTo(1, 5);
    }
    expect(result[365].day).toBe(365);
  });

  it("decays monotonically — higher stability retains better at day 30", () => {
    const point = computeForgettingCurves()[30];
    const [stable365, stable90, stable30, stable7, stable1] = FORGETTING_LABELS;
    expect(point[stable365]).toBeGreaterThan(point[stable90]);
    expect(point[stable90]).toBeGreaterThan(point[stable30]);
    expect(point[stable30]).toBeGreaterThan(point[stable7]);
    expect(point[stable7]).toBeGreaterThan(point[stable1]);
  });
});

// ── computeRetentionTradeoff ───────────────────────────────────────────

describe("computeRetentionTradeoff", () => {
  it("returns the 6 targets in ascending order", () => {
    const result = computeRetentionTradeoff([], 0.85);
    expect(result.map((r) => r.targetRetention)).toEqual([
      0.8, 0.85, 0.87, 0.9, 0.92, 0.95,
    ]);
  });

  it("yields zero workload with no non-New cards", () => {
    const result = computeRetentionTradeoff(
      [makeCard({ state: State.New })],
      0.85,
    );
    expect(result.every((r) => r.workload === 0)).toBe(true);
  });

  it("raises workload monotonically as target retention increases", () => {
    const cards = Array.from({ length: 10 }, () =>
      makeCard({ state: State.Review, stability: 1, difficulty: 5 }),
    );
    const result = computeRetentionTradeoff(cards, 0.85);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].workload).toBeGreaterThanOrEqual(result[i - 1].workload);
    }
    expect(result[0].workload).toBeLessThan(result[result.length - 1].workload);
  });

  it("honors a custom w[19] parameter", () => {
    const cards = Array.from({ length: 10 }, () =>
      makeCard({ state: State.Review, stability: 1, difficulty: 5 }),
    );
    const defaultW = computeRetentionTradeoff(cards, 0.85);
    const customW = computeRetentionTradeoff(cards, 0.85, [
      ...Array(19).fill(0.5),
      0.3,
    ]);
    // Verified: N=10, stability=1 → default w20=0.1542 gives workload 3.0,
    // custom w20=0.3 gives 3.8 at the first target — both far from 0.0.
    expect(customW[0].workload).toBeGreaterThan(0);
    expect(customW[0].workload).not.toBe(defaultW[0].workload);
  });
});

// ── computeOverviewStats ───────────────────────────────────────────────

describe("computeOverviewStats", () => {
  it("counts state buckets, dueToday, and averages over non-New cards", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

    const result = computeOverviewStats([
      makeCard({ state: State.New }), // newCards
      makeCard({
        state: State.Learning,
        stability: 10,
        difficulty: 5,
        due: new Date("2026-06-14T00:00:00Z"), // overdue → dueToday
        last_review: new Date("2026-06-15T12:00:00Z"),
      }),
      makeCard({
        state: State.Review,
        stability: 20,
        difficulty: 6,
        due: new Date("2026-06-16T00:00:00Z"), // future → not dueToday
        last_review: new Date("2026-06-15T12:00:00Z"),
      }),
      makeCard({
        state: State.Relearning,
        stability: 30,
        difficulty: 7,
        due: new Date("2026-06-14T00:00:00Z"),
        last_review: new Date("2026-06-15T12:00:00Z"),
      }),
    ]);

    expect(result.total).toBe(4);
    expect(result.newCards).toBe(1);
    expect(result.learning).toBe(1);
    expect(result.review).toBe(1);
    expect(result.relearning).toBe(1);
    expect(result.dueToday).toBe(2);
    expect(result.avgStability).toBe(20); // (10+20+30)/3
    expect(result.avgDifficulty).toBe(6); // (5+6+7)/3
    expect(result.avgRetrievability).toBeCloseTo(1, 5); // last_review == now
  });

  it("returns zeroed averages and dueToday with no non-New cards", () => {
    const result = computeOverviewStats([makeCard({ state: State.New })]);
    expect(result.total).toBe(1);
    expect(result.newCards).toBe(1);
    expect(result.dueToday).toBe(0);
    expect(result.avgStability).toBe(0);
    expect(result.avgDifficulty).toBe(0);
    expect(result.avgRetrievability).toBe(0);
  });
});
