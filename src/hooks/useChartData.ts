import { useMemo } from "react";
import { useStatsStore } from "@/stores/stats.store";
import type { Card } from "ts-fsrs";

interface UseChartDataResult {
  logs: ReturnType<typeof useStatsStore.getState>["rawReviewLogs"];
  cards: Card[];
  /** Parsed cards as a Map (needed by computeKnowledgeGrowth / OverviewCards) */
  parsedCards: Map<string, Card>;
  /** Total annotation count (not highlights) — used to derive newCards. */
  annotationCount: number;
  loading: boolean;
  isEmpty: boolean;
}

/**
 * Shared hook for all Stats Dashboard chart components.
 *
 * Reads raw review logs and parsed FSRS cards from the stats store.
 * Returns pre-computed cards array and an isEmpty flag so every chart
 * can skip the same 3-selector boilerplate.
 */
export function useChartData(): UseChartDataResult {
  const logs = useStatsStore((s) => s.rawReviewLogs);
  const parsedCards = useStatsStore((s) => s.parsedCards);
  const annotationCount = useStatsStore((s) => s.annotationCount);
  const dataVersion = useStatsStore((s) => s.dataVersion);
  const loading = useStatsStore((s) => s.loading);

  const cards = useMemo(
    () => Array.from(parsedCards.values()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsedCards, dataVersion],
  );

  const isEmpty = useMemo(
    () => logs.length === 0 && cards.length === 0,
    [logs.length, cards.length],
  );

  return { logs, cards, parsedCards, annotationCount, loading, isEmpty };
}
