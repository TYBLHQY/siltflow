import { create } from "zustand";
import { useReviewLogStore } from "./review-log.store";
import type { AIAnnotationData } from "@siltflow/shared/types";
import type { Card } from "ts-fsrs";

export interface AnnotationEmbedData {
  position: { boundingRect: any; rects: any[]; pageNumber: number };
  content?: { text?: string };
}

export interface AnnotationItem {
  id: string;
  documentId: string;
  type: string;
  text: string;
  pageNumber: number;
  embedData: AnnotationEmbedData;
  aiResult?: AIAnnotationData | null;
  fsrsCard?: Card;
}

interface AnnotationState {
  items: AnnotationItem[];
  setItems: (items: AnnotationItem[]) => void;
  addItem: (item: AnnotationItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<AnnotationItem>) => void;
  clear: () => void;
}

async function persistAnnotation(item: AnnotationItem) {
  const { runSql } = await import("../database");
  const now = new Date().toISOString();
  await runSql(
    `INSERT OR REPLACE INTO annotations (id, document_id, type, text, page_number, embed_data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM annotations WHERE id = ? AND document_id = ?), ?), ?)`,
    [
      item.id, item.documentId, item.type, item.text, item.pageNumber,
      JSON.stringify(item.embedData), item.id, item.documentId, now, now,
    ],
  );
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  items: [],

  setItems: (items) => set({ items }),
  addItem: (item) => {
    persistAnnotation(item);
    set((s) => ({ items: [...s.items, item] }));
  },

  removeItem: (id) => {
    const current = useAnnotationStore
      .getState()
      .items.find((i) => i.id === id);
    if (current) {
      (async () => {
        const { runSql } = await import("../database");
        await runSql("DELETE FROM annotations WHERE id = ? AND document_id = ?", [
          id, current.documentId,
        ]);
        await runSql("DELETE FROM ai_results WHERE annotation_id = ? AND document_id = ?", [
          id, current.documentId,
        ]);
        await runSql("DELETE FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?", [
          id, current.documentId,
        ]);
        await runSql("DELETE FROM review_logs WHERE annotation_id = ? AND document_id = ?", [
          id, current.documentId,
        ]);
      })();
      useReviewLogStore.getState().clearAnnotation(id);
    }
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  updateItem: (id, patch) => {
    const current = useAnnotationStore
      .getState()
      .items.find((i) => i.id === id);
    if (current) {
      const merged = { ...current, ...patch };
      persistAnnotation(merged);
    }
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  },

  clear: () => set({ items: [] }),
}));
