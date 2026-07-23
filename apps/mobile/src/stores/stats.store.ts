/**
 * Stats store — mirrors desktop `stores/stats.store.ts`.
 *
 * Fetches raw data from the service layer, then computes chart data
 * using the pure functions from @siltflow/shared-lib.
 */

import { create } from "zustand";
import type { Card } from "ts-fsrs";
import { getSQLite } from "@/stores/db.store";
import {
  listAllFSRSCards,
} from "@/services/fsrs-cards.service";
import {
  listAllReviewLogs,
} from "@/services/review-logs.service";
import { listAllAnnotations } from "@/services/annotations.service";
import {
  computeOverviewStats,
  computeDailyReviews,
  computeGradeDistribution,
  computeStabilityHistogram,
  computeRetrievabilityHistogram,
  computeDifficultyHistogram,
  computeIntervalHistogram,
  computeKnowledgeGrowth,
  computeReviewForecast,
  computeForgettingCurves,
  computeRetentionTradeoff,
  type OverviewStats,
  type DailyReviewCount,
  type GradeDistItem,
  type HistogramBin,
  type KnowledgePoint,
  type ForecastDay,
  type ForgettingCurvePoint,
  type RetentionTradeoffPoint,
} from "@siltflow/shared-lib";

interface StatsState {
  cards: Card[];
  reviewLogs: { createdAt: string; data: string; annotationId: string }[];
  annotationCount: number;
  loaded: boolean;
  loading: boolean;

  loadFromDb: () => void;
  getOverview: () => OverviewStats;
  getDailyReviews: (days?: number) => DailyReviewCount[];
  getGradeDistribution: () => GradeDistItem[];
  getStabilityHistogram: () => HistogramBin[];
  getRetrievabilityHistogram: () => HistogramBin[];
  getDifficultyHistogram: () => HistogramBin[];
  getIntervalHistogram: () => HistogramBin[];
  getKnowledgeGrowth: () => KnowledgePoint[];
  getReviewForecast: (days?: number) => ForecastDay[];
  getForgettingCurves: () => ForgettingCurvePoint[];
  getRetentionTradeoff: () => RetentionTradeoffPoint[];
}

export const useStatsStore = create<StatsState>((set, get) => ({
  cards: [],
  reviewLogs: [],
  annotationCount: 0,
  loaded: false,
  loading: false,

  loadFromDb: () => {
    if (get().loaded) return;
    set({ loading: true });
    try {
      const db = getSQLite();

      // Fetch raw data in parallel
      const cardRows = listAllFSRSCards(db);
      const logRows = listAllReviewLogs(db);
      const annotations = listAllAnnotations(db);

      // Parse cards from raw JSON strings
      const cards: Card[] = [];
      for (const row of cardRows) {
        try {
          cards.push(JSON.parse(row.data) as Card);
        } catch {
          /* skip corrupt data */
        }
      }

      const reviewLogs = logRows.map((r) => ({
        createdAt: r.createdAt,
        data: r.data,
        annotationId: r.annotationId,
      }));

      set({
        cards,
        reviewLogs,
        annotationCount: annotations.length,
        loaded: true,
      });
    } catch (err) {
      console.error("[stats.store] loadFromDb failed:", err);
    } finally {
      set({ loading: false });
    }
  },

  // ── Computed getters (pure, no side effects) ───────────────────

  getOverview: () => computeOverviewStats(get().cards),
  getDailyReviews: (days) => computeDailyReviews(get().reviewLogs, days),
  getGradeDistribution: () => computeGradeDistribution(get().reviewLogs),
  getStabilityHistogram: () => computeStabilityHistogram(get().cards),
  getRetrievabilityHistogram: () => computeRetrievabilityHistogram(get().cards),
  getDifficultyHistogram: () => computeDifficultyHistogram(get().cards),
  getIntervalHistogram: () => computeIntervalHistogram(get().cards),
  getKnowledgeGrowth: () => computeKnowledgeGrowth(get().reviewLogs),
  getReviewForecast: (days) => computeReviewForecast(get().cards, days),
  getForgettingCurves: () => computeForgettingCurves(),
  getRetentionTradeoff: () => {
    const params = useFSRSStore.getState().params;
    return computeRetentionTradeoff(
      get().cards,
      params.request_retention,
      params.w,
    );
  },
}));

// Import at bottom to avoid circular
import { useFSRSStore } from "@/stores/fsrs.store";
