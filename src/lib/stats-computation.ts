/**
 * Pure computation functions for the Stats Dashboard.
 * Each function takes raw data (IPC rows) and returns chart-ready arrays.
 */
import { State } from "ts-fsrs";
import type { Card } from "ts-fsrs";
import { retrievability } from "@/lib/doc-review";

export interface DailyReviewCount {
  date: string;
  count: number;
  learnCount: number;
  reviewCount: number;
}

export interface GradeDistItem {
  name: "Again" | "Hard" | "Good" | "Easy";
  value: number;
  color: string;
}

export interface HistogramBin {
  label: string;
  count: number;
}

export interface KnowledgePoint {
  date: string;
  learning: number;
  young: number;
  mature: number;
  longTerm: number;
}

export interface ForecastDay {
  date: string;
  dueCount: number;
}

export const FORGETTING_LABELS = ["365 days", "90 days", "30 days", "7 days", "1 day"] as const;

export type ForgettingCurvePoint = {
  day: number;
} & Record<(typeof FORGETTING_LABELS)[number], number>;

export interface RetentionTradeoffPoint {
  targetRetention: number;
  workload: number;
  avgStability: number;
}

export interface OverviewStats {
  total: number;
  dueToday: number;
  newCards: number;
  learning: number;
  review: number;
  relearning: number;
  avgStability: number;
  avgDifficulty: number;
  avgRetrievability: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GRADE_COLORS: Record<string, string> = {
  Again: "var(--catppuccin-color-red)",
  Hard: "var(--catppuccin-color-peach)",
  Good: "var(--catppuccin-color-green)",
  Easy: "var(--catppuccin-color-blue)",
};

const GRADE_NAMES: Record<number, "Again" | "Hard" | "Good" | "Easy"> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

/** Parse the data field of a review_log IPC row. */
function parseLogData(raw: string): { grade: number; log: { state: number; stability: number; difficulty: number; scheduled_days: number }; card: { due: string; stability: number; difficulty: number; scheduled_days: number; reps: number; lapses: number; state: number } } {
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Chart 1 & 2: Daily Reviews / New vs Review
// ---------------------------------------------------------------------------

export function computeDailyReviews(
  logs: { createdAt: string; data: string }[],
  days?: number,
): DailyReviewCount[] {
  const map = new Map<string, { count: number; learnCount: number; reviewCount: number }>();
  const now = Date.now();
  const cutoff = days ? new Date(now - days * 86400000).toISOString().slice(0, 10) : undefined;

  for (const entry of logs) {
    const date = entry.createdAt.slice(0, 10);
    if (cutoff && date < cutoff) continue;
    const parsed = parseLogData(entry.data);
    const state = parsed.log.state;
    const row = map.get(date) ?? { count: 0, learnCount: 0, reviewCount: 0 };
    row.count++;
    if (state === 2) {
      row.reviewCount++;
    } else {
      row.learnCount++;
    }
    map.set(date, row);
  }

  return Array.from(map.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Chart 3: Calendar Heatmap
// ---------------------------------------------------------------------------

export function computeCalendarHeatmap(
  logs: { createdAt: string }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of logs) {
    const date = entry.createdAt.slice(0, 10);
    map.set(date, (map.get(date) ?? 0) + 1);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Chart 4: Recall Rate (Grade Distribution)
// ---------------------------------------------------------------------------

export function computeGradeDistribution(logs: { data: string }[]): GradeDistItem[] {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const entry of logs) {
    const grade = parseLogData(entry.data).grade;
    if (grade >= 1 && grade <= 4) counts[grade]++;
  }
  return ([1, 2, 3, 4] as const).map((g) => ({
    name: GRADE_NAMES[g],
    value: counts[g],
    color: GRADE_COLORS[GRADE_NAMES[g]],
  }));
}

// ---------------------------------------------------------------------------
// Chart 5: Stability Distribution (histogram)
// ---------------------------------------------------------------------------

export function computeStabilityHistogram(cards: Card[]): HistogramBin[] {
  const bins: { label: string; min: number; max: number; count: number }[] = [
    { label: "<1d", min: 0, max: 1, count: 0 },
    { label: "1–7d", min: 1, max: 7, count: 0 },
    { label: "7–30d", min: 7, max: 30, count: 0 },
    { label: "30–90d", min: 30, max: 90, count: 0 },
    { label: "90–365d", min: 90, max: 365, count: 0 },
    { label: ">1y", min: 365, max: Infinity, count: 0 },
  ];

  for (const card of cards) {
    if (card.state === State.New) continue;
    for (const bin of bins) {
      if (card.stability >= bin.min && card.stability < bin.max) {
        bin.count++;
        break;
      }
    }
  }
  return bins.map((b) => ({ label: b.label, count: b.count }));
}

// ---------------------------------------------------------------------------
// Chart 6: Retrievability Distribution (histogram)
// ---------------------------------------------------------------------------

export function computeRetrievabilityHistogram(cards: Card[]): HistogramBin[] {
  const now = Date.now();
  const dayMs = 86400000;
  const bins: HistogramBin[] = [];
  for (let i = 0; i < 10; i++) {
    bins.push({ label: `${i * 10}–${(i + 1) * 10}%`, count: 0 });
  }

  for (const card of cards) {
    if (card.state === State.New) continue;
    const due = card.due instanceof Date ? card.due : new Date(card.due);
    const elapsedDays = now > due.getTime() ? (now - due.getTime()) / dayMs : 0;
    const r = retrievability(card.stability, elapsedDays);
    const idx = Math.min(Math.floor(r * 10), 9);
    bins[idx].count++;
  }
  return bins;
}

// ---------------------------------------------------------------------------
// Chart 7: Difficulty Distribution (histogram)
// ---------------------------------------------------------------------------

export function computeDifficultyHistogram(cards: Card[]): HistogramBin[] {
  const bins: HistogramBin[] = [];
  for (let i = 0; i < 10; i++) {
    const lo = (i / 10).toFixed(1);
    const hi = ((i + 1) / 10).toFixed(1);
    bins.push({ label: `${lo}–${hi}`, count: 0 });
  }

  for (const card of cards) {
    if (card.state === State.New) continue;
    const d = card.difficulty;
    const idx = Math.min(Math.floor(d * 10), 9);
    bins[idx].count++;
  }
  return bins;
}

// ---------------------------------------------------------------------------
// Chart 8: Interval Distribution (histogram)
// ---------------------------------------------------------------------------

export function computeIntervalHistogram(cards: Card[]): HistogramBin[] {
  const bins: { label: string; min: number; max: number; count: number }[] = [
    { label: "<1d", min: 0, max: 1, count: 0 },
    { label: "1–7d", min: 1, max: 7, count: 0 },
    { label: "7–30d", min: 7, max: 30, count: 0 },
    { label: "30–90d", min: 30, max: 90, count: 0 },
    { label: "90–365d", min: 90, max: 365, count: 0 },
    { label: ">1y", min: 365, max: Infinity, count: 0 },
  ];

  for (const card of cards) {
    if (card.state === State.New) continue;
    const sd = card.scheduled_days;
    for (const bin of bins) {
      if (sd >= bin.min && sd < bin.max) {
        bin.count++;
        break;
      }
    }
  }
  return bins.map((b) => ({ label: b.label, count: b.count }));
}

// ---------------------------------------------------------------------------
// Chart 9: Knowledge Growth
// ---------------------------------------------------------------------------

export function computeKnowledgeGrowth(
  logs: { createdAt: string; data: string; annotationId: string }[],
  cardsMap: Map<string, Card>,
): KnowledgePoint[] {
  // Sort logs chronologically
  const sorted = [...logs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Track per-card states by annotationId
  const cardStates = new Map<string, "learning" | "young" | "mature" | "longTerm">();
  const daily: KnowledgePoint[] = [];
  let learning = 0, young = 0, mature = 0, longTerm = 0;

  for (const entry of sorted) {
    const parsed = parseLogData(entry.data);
    const cardSnap = parsed.card;
    const aid = entry.annotationId;

    // Determine bucket from the card snapshot after this review
    let bucket: "learning" | "young" | "mature" | "longTerm";
    if (cardSnap.state === 1 || cardSnap.state === 3) {
      bucket = "learning";
    } else if (cardSnap.state === 2) {
      if (cardSnap.stability < 21) bucket = "young";
      else if (cardSnap.stability < 365) bucket = "mature";
      else bucket = "longTerm";
    } else {
      continue;
    }

    const prev = cardStates.get(aid);
    if (prev === bucket) continue; // no change
    cardStates.set(aid, bucket);

    // Adjust counters
    if (prev) {
      if (prev === "learning") learning--;
      else if (prev === "young") young--;
      else if (prev === "mature") mature--;
      else if (prev === "longTerm") longTerm--;
    }
    if (bucket === "learning") learning++;
    else if (bucket === "young") young++;
    else if (bucket === "mature") mature++;
    else if (bucket === "longTerm") longTerm++;

    daily.push({
      date: entry.createdAt.slice(0, 10),
      learning,
      young,
      mature,
      longTerm,
    });
  }

  // Also count cards that have cards but no review logs (New cards → learning)
  for (const [aid] of cardsMap) {
    if (!cardStates.has(aid)) {
      cardStates.set(aid, "learning");
      learning++;
    }
  }

  if (daily.length === 0 && learning > 0) {
    daily.push({
      date: new Date().toISOString().slice(0, 10),
      learning,
      young,
      mature,
      longTerm,
    });
  }

  return daily;
}

function fmtLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Chart 10: Review Forecast
// ---------------------------------------------------------------------------

export function computeReviewForecast(cards: Card[], days = 14): ForecastDay[] {
  const now = new Date();
  // Start of tomorrow in local timezone — cards due today are "overdue"
  const startMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();
  const endMs = startMs + (days - 1) * 86400000;
  const map = new Map<string, number>();

  for (const card of cards) {
    if (card.state === State.New) continue;
    const due = card.due instanceof Date ? card.due : new Date(card.due);
    const dueMs = due.getTime();
    if (dueMs >= startMs && dueMs <= endMs) {
      const date = fmtLocalDate(due);
      map.set(date, (map.get(date) ?? 0) + 1);
    }
  }

  const result: ForecastDay[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1 + i);
    result.push({ date: fmtLocalDate(d), dueCount: map.get(fmtLocalDate(d)) ?? 0 });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Chart 11: Forgetting Curves (theoretical)
// ---------------------------------------------------------------------------

export function computeForgettingCurves(): ForgettingCurvePoint[] {
  const stabilities = [365, 90, 30, 7, 1];
  const points: ForgettingCurvePoint[] = [];

  for (let day = 0; day <= 365; day++) {
    const row: Record<string, number> = { day };
    for (let i = 0; i < stabilities.length; i++) {
      row[FORGETTING_LABELS[i]] = retrievability(stabilities[i], day);
    }
    points.push(row as unknown as ForgettingCurvePoint);
  }
  return points;
}

// ---------------------------------------------------------------------------
// Chart 12: Retention Optimization (tradeoff)
// ---------------------------------------------------------------------------

export function computeRetentionTradeoff(
  cards: Card[],
  _requestRetention: number,
  w?: number[],
): RetentionTradeoffPoint[] {
  const w20 = w?.[19] ?? 0.1542;
  const targets = [0.80, 0.85, 0.87, 0.90, 0.92, 0.95];

  // Current average stability
  const nonNew = cards.filter((c) => c.state !== State.New);
  const avgStab =
    nonNew.length > 0
      ? nonNew.reduce((s, c) => s + c.stability, 0) / nonNew.length
      : 1;

  return targets.map((target) => {
    // FSRS interval formula relative to current retention
    const factor = (Math.pow(0.9, -1 / w20) - 1) / (Math.pow(target, -1 / w20) - 1);
    // Average workload: how many cards would be due per day
    const avgInterval = avgStab * factor;
    const workload = nonNew.length > 0 ? nonNew.length / Math.max(avgInterval, 1) : 0;

    return {
      targetRetention: target,
      workload: Math.round(workload * 10) / 10,
      avgStability: Math.round(avgStab * 10) / 10,
    };
  });
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export function computeOverviewStats(cards: Card[], _reviewLogs: { data: string }[]): OverviewStats {
  const now = Date.now();
  const dayMs = 86400000;
  let dueToday = 0,
    learning = 0,
    review = 0,
    relearning = 0,
    stabSum = 0,
    diffSum = 0,
    retSum = 0,
    nonNewCount = 0;

  for (const card of cards) {
    if (card.state === State.Learning) learning++;
    else if (card.state === State.Review) review++;
    else if (card.state === State.Relearning) relearning++;

    if (card.state !== State.New) {
      nonNewCount++;
      stabSum += card.stability;
      diffSum += card.difficulty;
      const due = card.due instanceof Date ? card.due : new Date(card.due);
      const elapsedDays = now > due.getTime() ? (now - due.getTime()) / dayMs : 0;
      retSum += retrievability(card.stability, elapsedDays);

      if (due.getTime() <= now) {
        dueToday++;
      }
    }
  }

  return {
    total: cards.length,
    dueToday,
    newCards: cards.filter((c) => c.state === State.New).length,
    learning,
    review,
    relearning,
    avgStability: nonNewCount > 0 ? stabSum / nonNewCount : 0,
    avgDifficulty: nonNewCount > 0 ? diffSum / nonNewCount : 0,
    avgRetrievability: nonNewCount > 0 ? retSum / nonNewCount : 0,
  };
}
