/**
 * Zustand store for the Stats Dashboard.
 *
 * Loads all FSRS cards and review logs from the backend via IPC,
 * caches parsed data, and provides a dataVersion for memoized chart components.
 */
import { create } from "zustand";
import type { Card } from "ts-fsrs";

interface FSRSCardRow {
  annotationId: string;
  documentId: string;
  data: string;
  createdAt: string;
  updatedAt: string;
}

interface ReviewLogRow {
  id: string;
  annotationId: string;
  documentId: string;
  data: string;
  createdAt: string;
}

interface StatsStoreState {
  loaded: boolean;
  loading: boolean;
  error: string | null;

  rawCards: FSRSCardRow[];
  rawReviewLogs: ReviewLogRow[];
  parsedCards: Map<string, Card>;

  /** Total annotation count (kind = 'annotation') — used to derive newCards. */
  annotationCount: number;

  /** Incremented after each successful data load, so memoized components re-compute. */
  dataVersion: number;

  loadAllData: () => Promise<void>;
}

export const useStatsStore = create<StatsStoreState>((set) => ({
  loaded: false,
  loading: false,
  error: null,
  rawCards: [],
  rawReviewLogs: [],
  parsedCards: new Map(),
  annotationCount: 0,
  dataVersion: 0,

  loadAllData: async () => {
    set({ loading: true, error: null });
    try {
      const [cards, logs, allAnnotations] = await Promise.all([
        window.siltflow.fsrsCards.listAll(),
        window.siltflow.reviewLogs.listAll(),
        window.siltflow.annotations.listAll(),
      ]);

      // Parse cards into a Map keyed by annotationId for efficient lookups
      const parsed = new Map<string, Card>();
      for (const row of cards) {
        try {
          parsed.set(row.annotationId, JSON.parse(row.data) as Card);
        } catch {
          // skip malformed JSON
        }
      }

      // Count real annotations (not highlights) to derive newCards:
      //   newCards = annotationCount - cardsWithFSRS
      const annotationCount = allAnnotations.filter(
        (a) => a.kind !== "highlight",
      ).length;

      set({
        rawCards: cards,
        rawReviewLogs: logs,
        parsedCards: parsed,
        annotationCount,
        loaded: true,
        loading: false,
        error: null,
        dataVersion: Date.now(),
      });
    } catch (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      err: any
    ) {
      set({
        loading: false,
        error: err?.message ?? "Failed to load statistics data",
      });
    }
  },
}));
