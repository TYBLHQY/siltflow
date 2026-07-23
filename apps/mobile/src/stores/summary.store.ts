/**
 * Summary store — mirrors desktop `stores/summary.store.ts`.
 */

import { create } from "zustand";
import { getSQLite } from "@/stores/db.store";
import {
  listAllSummaries,
  saveSummary,
  deleteSummary,
} from "@/services/summaries.service";

interface SummaryState {
  summaries: Record<string, { text: string; isAiGenerated: boolean; sourceLang?: string }>;
  loading: boolean;
  loaded: boolean;

  loadFromDb: () => void;
  getSummary: (documentId: string) => { text: string; isAiGenerated: boolean; sourceLang?: string } | undefined;
  saveSummary: (documentId: string, text: string, isAiGenerated: boolean, sourceLang?: string) => void;
  deleteSummary: (documentId: string) => void;
}

export const useSummaryStore = create<SummaryState>((set, get) => ({
  summaries: {},
  loading: false,
  loaded: false,

  loadFromDb: () => {
    if (get().loaded) return;
    set({ loading: true });
    try {
      const db = getSQLite();
      const rows = listAllSummaries(db);
      const summaries: SummaryState["summaries"] = {};
      for (const row of rows) {
        const docId = row.document_id as string;
        summaries[docId] = {
          text: row.text as string,
          isAiGenerated: Boolean(row.is_ai_generated),
          sourceLang: row.source_lang as string | undefined,
        };
      }
      set({ summaries, loaded: true });
    } catch (err) {
      console.error("[summary.store] loadFromDb failed:", err);
    } finally {
      set({ loading: false });
    }
  },

  getSummary: (documentId) => {
    return get().summaries[documentId];
  },

  saveSummary: (documentId, text, isAiGenerated, sourceLang) => {
    try {
      const db = getSQLite();
      saveSummary(db, { documentId, text, isAiGenerated, sourceLang });
      set((s) => ({
        summaries: {
          ...s.summaries,
          [documentId]: { text, isAiGenerated, sourceLang },
        },
      }));
    } catch (err) {
      console.error("[summary.store] saveSummary failed:", err);
    }
  },

  deleteSummary: (documentId) => {
    try {
      const db = getSQLite();
      deleteSummary(db, documentId);
      set((s) => {
        const next = { ...s.summaries };
        delete next[documentId];
        return { summaries: next };
      });
    } catch (err) {
      console.error("[summary.store] deleteSummary failed:", err);
    }
  },
}));
