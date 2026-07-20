import { create } from "zustand";
import type { ScaledPosition, Content } from "react-pdf-highlighter-plus";
import type {
  AIAnnotationDataV1,
  AIAnnotationDataV2,
} from "@/types/annotation";
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
  /** Whether this is a full annotation ("annotation"), a visual-only highlight ("highlight"), or a user-added manual card ("manual"). */
  kind: "annotation" | "highlight" | "manual";
  text: string;
  /** 1-indexed page number, consistent with react-pdf-highlighter-plus */
  pageNumber: number;
  embedData: AnnotationEmbedData;
  /** AI analysis result — populated after translation request completes */
  aiResult?: AIAnnotationDataV1 | AIAnnotationDataV2 | null;
  /** AI data version from ai_results.version, undefined if not yet translated. */
  aiVersion?: number | null;
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
  window.siltflow.annotations
    .save({
      id: item.id,
      documentId: item.documentId,
      type: item.type,
      text: item.text,
      pageNumber: item.pageNumber,
      embedData: JSON.stringify(item.embedData),
      kind: item.kind || "annotation",
    })
    .catch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err: any) => {
        console.error("[annotation.store] persistAnnotation failed:", err);
      },
    );
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  items: [],

  setItems: (items) => set({ items }),
  addItem: (item) => {
    persistAnnotation(item);
    if (item.aiResult) {
      window.siltflow.aiResults
        .save(item.id, item.documentId, item.aiResult, item.aiVersion ?? 1)
        .catch(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (err: any) => {
            console.error("[annotation.store] aiResults.save failed:", err);
          },
        );
    }
    if (item.fsrsCard) {
      window.siltflow.fsrsCards
        .save(item.id, item.documentId, item.fsrsCard)
        .catch(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (err: any) => {
            console.error("[annotation.store] fsrsCards.save failed:", err);
          },
        );
    }
    set((s) => ({ items: [item, ...s.items] }));
  },

  removeItem: (id) => {
    const current = useAnnotationStore
      .getState()
      .items.find((i) => i.id === id);
    if (current) {
      // Backend deletes in a single transaction (annotation + ai_results + fsrs_cards + review_logs)
      window.siltflow.annotations.delete(id, current.documentId).catch(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err: any) => {
          console.error("[annotation.store] annotations.delete failed:", err);
        },
      );
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
      // When aiResult is set (not null, not deletion), assign the caller-specified
      // version, or default to 1 for backward compatibility.
      if (patch.aiResult && patch.aiResult !== null) {
        // Version is assigned by the caller (translate function knows its version).
        // Fall back to 1 if no version provided (v1 callers).
        if (patch.aiVersion === undefined || patch.aiVersion === null) {
          patch.aiVersion = 1;
        }
      }
      const merged = { ...current, ...patch };
      // Always persist the annotation core
      persistAnnotation(merged);
      // Persist side tables if changed
      if (patch.aiResult !== undefined) {
        const saveVersion = patch.aiVersion ?? 1;
        // Persist to DB. Use the caller-assigned version so V2 data
        // survives app refresh (the IPC previously always wrote version=1).
        window.siltflow.aiResults
          .save(id, current.documentId, patch.aiResult, saveVersion)
          .catch(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (err: any) => {
              console.error("[annotation.store] aiResults.save failed:", err);
            },
          );
      }
      if (patch.fsrsCard !== undefined) {
        window.siltflow.fsrsCards
          .save(id, current.documentId, patch.fsrsCard)
          .catch(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (err: any) => {
              console.error("[annotation.store] fsrsCards.save failed:", err);
            },
          );
      }
    }
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  },

  clear: () => set({ items: [] }),
}));
