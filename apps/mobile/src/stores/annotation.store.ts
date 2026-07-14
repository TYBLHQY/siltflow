import { create } from "zustand";
import { getDb, nowISO } from "../database";
import type { AIAnnotationData } from "@siltflow/shared/types";
import type { Card } from "ts-fsrs";
import { useReviewLogStore } from "./review-log.store";

export interface AnnotationEmbedData {
  position: any;
  content?: any;
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
  addItem: (item: AnnotationItem) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateItem: (id: string, patch: Partial<AnnotationItem>) => Promise<void>;
  clear: () => void;
}

async function persistAnnotation(item: AnnotationItem) {
  const db = getDb();
  const now = nowISO();
  await db.runAsync(
    `INSERT OR REPLACE INTO annotations (id, document_id, type, text, page_number, embed_data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.documentId,
    item.type,
    item.text ?? "",
    item.pageNumber ?? 0,
    JSON.stringify(item.embedData),
    now,
    now,
  );
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  items: [],

  setItems: (items) => set({ items }),

  addItem: async (item) => {
    await persistAnnotation(item);
    if (item.aiResult) {
      const db = getDb();
      const now = nowISO();
      await db.runAsync(
        `INSERT OR REPLACE INTO ai_results (annotation_id, document_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        item.id, item.documentId, JSON.stringify(item.aiResult), now, now,
      );
    }
    if (item.fsrsCard) {
      const db = getDb();
      const now = nowISO();
      await db.runAsync(
        `INSERT OR REPLACE INTO fsrs_cards (annotation_id, document_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        item.id, item.documentId, JSON.stringify(item.fsrsCard), now, now,
      );
    }
    set((s) => ({ items: [...s.items, item] }));
  },

  removeItem: async (id) => {
    const current = useAnnotationStore.getState().items.find((i) => i.id === id);
    if (current) {
      const db = getDb();
      await db.execAsync(
        `DELETE FROM ai_results WHERE annotation_id = ? AND document_id = ?`,
      );
      await db.runAsync(
        "DELETE FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?",
        id, current.documentId,
      );
      await db.runAsync(
        "DELETE FROM review_logs WHERE annotation_id = ? AND document_id = ?",
        id, current.documentId,
      );
      await db.runAsync(
        "DELETE FROM annotations WHERE id = ? AND document_id = ?",
        id, current.documentId,
      );
      useReviewLogStore.getState().clearAnnotation(id);
    }
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  updateItem: async (id, patch) => {
    const current = useAnnotationStore.getState().items.find((i) => i.id === id);
    if (current) {
      const merged = { ...current, ...patch };
      await persistAnnotation(merged);

      const db = getDb();
      const now = nowISO();

      if (patch.aiResult !== undefined) {
        await db.runAsync(
          `INSERT OR REPLACE INTO ai_results (annotation_id, document_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
          id, current.documentId, JSON.stringify(patch.aiResult), now, now,
        );
      }
      if (patch.fsrsCard !== undefined) {
        await db.runAsync(
          `INSERT OR REPLACE INTO fsrs_cards (annotation_id, document_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
          id, current.documentId, JSON.stringify(patch.fsrsCard), now, now,
        );
      }
    }
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  },

  clear: () => set({ items: [] }),
}));
