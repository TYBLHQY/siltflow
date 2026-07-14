import { create } from "zustand";
import type { Card } from "ts-fsrs";
import { getDb } from "../database";

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
      const db = getDb();

      const [cards, logs] = await Promise.all([
        db.getAllAsync<any>(
          "SELECT annotation_id AS annotationId, document_id AS documentId, data, created_at AS createdAt, updated_at AS updatedAt FROM fsrs_cards",
        ),
        db.getAllAsync<any>(
          "SELECT id, annotation_id AS annotationId, document_id AS documentId, data, created_at AS createdAt FROM review_logs",
        ),
      ]);

      const parsed = new Map<string, Card>();
      for (const row of cards) {
        try {
          parsed.set(row.annotationId, JSON.parse(row.data) as Card);
        } catch {
          // skip malformed JSON
        }
      }

      set({
        rawCards: cards || [],
        rawReviewLogs: logs || [],
        parsedCards: parsed,
        loaded: true,
        loading: false,
        error: null,
        dataVersion: Date.now(),
      });
    } catch (err: any) {
      set({ loading: false, error: err?.message ?? "Failed to load statistics data" });
    }
  },
}));
