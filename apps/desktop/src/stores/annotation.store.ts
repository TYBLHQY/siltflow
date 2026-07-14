import { create } from "zustand";
import type { ScaledPosition, Content } from "react-pdf-highlighter-plus";
import type { AIAnnotationData } from "@siltflow/shared/types";
import type { Card } from "ts-fsrs";
import { useReviewLogStore } from "@/stores/review-log.store";

export interface AnnotationEmbedData {
  position: ScaledPosition;
  content?: Content;
}

export interface AnnotationItem {
  id: string;
  documentId: string;
  type: string;
  text: string;
  /** 1-indexed page number, consistent with react-pdf-highlighter-plus */
  pageNumber: number;
  embedData: AnnotationEmbedData;
  /** AI analysis result — populated after translation request completes */
  aiResult?: AIAnnotationData | null;
  /** FSRS card state — set when first reviewed */
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

/** Persist the full annotation to the Electron backend. */
function persistAnnotation(item: AnnotationItem) {
  window.siltflow.annotations.save({
    id: item.id,
    documentId: item.documentId,
    type: item.type,
    text: item.text,
    pageNumber: item.pageNumber,
    embedData: JSON.stringify(item.embedData),
  });
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  items: [],

  setItems: (items) => set({ items }),
  addItem: (item) => {
    persistAnnotation(item);
    if (item.aiResult) {
      window.siltflow.aiResults.save(item.id, item.documentId, item.aiResult);
    }
    if (item.fsrsCard) {
      window.siltflow.fsrsCards.save(item.id, item.documentId, item.fsrsCard);
    }
    set((s) => ({ items: [...s.items, item] }));
  },

  removeItem: (id) => {
    const current = useAnnotationStore
      .getState()
      .items.find((i) => i.id === id);
    if (current) {
      // Backend deletes in a single transaction (annotation + ai_results + fsrs_cards + review_logs)
      window.siltflow.annotations
        .delete(id, current.documentId)
        .catch(() => {});
      // Clear in-memory cache
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
      // Always persist the annotation core
      persistAnnotation(merged);
      // Persist side tables if changed
      if (patch.aiResult !== undefined) {
        window.siltflow.aiResults.save(id, current.documentId, patch.aiResult);
      }
      if (patch.fsrsCard !== undefined) {
        window.siltflow.fsrsCards.save(id, current.documentId, patch.fsrsCard);
      }
    }
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  },

  clear: () => set({ items: [] }),
}));
