/**
 * Annotation store — mirrors desktop `stores/annotation.store.ts`.
 *
 * Handles optimistic UI updates with background persistence.
 * Annotations are enriched with AI results and FSRS card data.
 */

import { create } from "zustand";
import { getSQLite } from "@/stores/db.store";
import {
  saveAnnotation,
  deleteAnnotation,
  saveAIResult,
  saveFSRSCard,
} from "@/services";
import type { AnnotationEnriched, AnnotationSaveRequest } from "@/services/types";

export type AnnotationKind = "annotation" | "highlight" | "manual";

export interface AnnotationItem {
  id: string;
  documentId: string;
  type: string;
  kind: AnnotationKind;
  text: string;
  pageNumber: number;
  embedData: unknown;
  aiResult?: unknown;
  aiVersion?: number | null;
  fsrsCard?: unknown;
}

interface AnnotationState {
  items: AnnotationItem[];
  setItems: (items: AnnotationItem[]) => void;
  addItem: (item: AnnotationItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<AnnotationItem>) => void;
  clear: () => void;
}

// ── Persistence helpers ──────────────────────────────────────────────

function persistAnnotation(item: AnnotationItem) {
  try {
    const db = getSQLite();
    const req: AnnotationSaveRequest = {
      id: item.id,
      document_id: item.documentId,
      type: item.type,
      text: item.text,
      page_number: item.pageNumber,
      embed_data: JSON.stringify(item.embedData),
      kind: item.kind || "annotation",
    };
    saveAnnotation(db, req);
  } catch (err) {
    console.error("[annotation.store] persistAnnotation failed:", err);
  }
}

function persistAIResult(item: AnnotationItem) {
  if (!item.aiResult) return;
  try {
    const db = getSQLite();
    saveAIResult(
      db,
      item.id,
      item.documentId,
      item.aiResult,
      item.aiVersion ?? 1,
    );
  } catch (err) {
    console.error("[annotation.store] persistAIResult failed:", err);
  }
}

function persistFSRSCard(item: AnnotationItem) {
  if (!item.fsrsCard) return;
  try {
    const db = getSQLite();
    saveFSRSCard(db, item.id, item.documentId, item.fsrsCard);
  } catch (err) {
    console.error("[annotation.store] persistFSRSCard failed:", err);
  }
}

// ── Store ────────────────────────────────────────────────────────────

export const useAnnotationStore = create<AnnotationState>((set) => ({
  items: [],

  setItems: (items) => set({ items }),

  addItem: (item) => {
    persistAnnotation(item);
    if (item.aiResult) persistAIResult(item);
    if (item.fsrsCard) persistFSRSCard(item);
    set((s) => ({ items: [item, ...s.items] }));
  },

  removeItem: (id) => {
    const current = useAnnotationStore.getState().items.find((i) => i.id === id);
    if (current) {
      try {
        const db = getSQLite();
        deleteAnnotation(db, id, current.documentId);
      } catch (err) {
        console.error("[annotation.store] deleteAnnotation failed:", err);
      }
    }
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  updateItem: (id, patch) => {
    const current = useAnnotationStore.getState().items.find((i) => i.id === id);
    if (current) {
      if (patch.aiResult) {
        if (patch.aiVersion === undefined || patch.aiVersion === null) {
          patch.aiVersion = 1;
        }
      }
      const merged = { ...current, ...patch };
      persistAnnotation(merged);
      if (patch.aiResult !== undefined) {
        persistAIResult({ ...merged, aiVersion: patch.aiVersion ?? 1 });
      }
      if (patch.fsrsCard !== undefined) {
        persistFSRSCard(merged);
      }
    }
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  },

  clear: () => set({ items: [] }),
}));

// ── Enriched → store item conversion ─────────────────────────────────

export function enrichedToItem(enriched: AnnotationEnriched): AnnotationItem {
  return {
    id: enriched.id,
    documentId: enriched.document_id,
    type: enriched.type,
    kind: (enriched.kind as AnnotationKind) || "annotation",
    text: enriched.text ?? "",
    pageNumber: (enriched.page_number as number) ?? 0,
    embedData: enriched.embed_data,
    aiResult: enriched.ai_data,
    aiVersion: enriched.ai_version,
    fsrsCard: enriched.fsrs_data,
  };
}
