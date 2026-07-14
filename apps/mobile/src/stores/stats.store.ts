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
  dataVersion: 0,

  loadAllData: async () => {
    set({ loading: true, error: null });
    try {
      const { executeSql } = await import("../database");

      const cards = await executeSql("SELECT * FROM fsrs_cards");
      const logs = await executeSql("SELECT * FROM review_logs");

      // Parse cards into a Map keyed by annotationId for efficient lookups
      const parsed = new Map<string, Card>();
      for (const row of cards) {
        try {
          parsed.set(row.annotation_id, JSON.parse(row.data) as Card);
        } catch {
          // skip malformed JSON
        }
      }

      set({
        rawCards: cards.map((r: any) => ({
          annotationId: r.annotation_id,
          documentId: r.document_id,
          data: r.data,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
        rawReviewLogs: logs.map((r: any) => ({
          id: r.id,
          annotationId: r.annotation_id,
          documentId: r.document_id,
          data: r.data,
          createdAt: r.created_at,
        })),
        parsedCards: parsed,
        loaded: true,
        loading: false,
        error: null,
        dataVersion: Date.now(),
      });
    } catch (err: any) {
      set({
        loading: false,
        error: err?.message ?? "Failed to load statistics data",
      });
    }
  },
}));
