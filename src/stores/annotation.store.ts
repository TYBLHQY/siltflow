import { create } from "zustand";
import type { ScaledPosition, Content } from "react-pdf-highlighter-plus";
import type { AIAnnotationDataV2 } from "@/types/annotation";
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
  /** AI analysis result — populated after translation request completes. */
  aiResult?: AIAnnotationDataV2 | null;
  /** AI data version from ai_results.version, undefined if not yet translated. */
  aiVersion?: number | null;
  /**
   * User-authored context note for this annotation. Renders on the card and
   * is injected into the output AI stage only (never the input stage).
   */
  context?: string;
  /** FSRS card state — set when first reviewed */
  fsrsCard?: Card;
  /** ISO timestamp from the backend (created_at). Used for z-order tiebreaks. */
  createdAt?: string;
}

interface AnnotationState {
  items: AnnotationItem[];
  setItems: (items: AnnotationItem[]) => void;
  addItem: (item: AnnotationItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<AnnotationItem>) => void;
  clear: () => void;
  /** Manual-annotation dialog visibility (store-owned so a global shortcut can open it even when the panel is collapsed / tab is unmounted). */
  manualDialogOpen: boolean;
  openManualDialog: () => void;
  closeManualDialog: () => void;
}

/** Persist the full annotation to the Electron backend. */
function persistAnnotation(item: AnnotationItem) {
  window.siltflow.annotations
    .save({
      id: item.id,
      document_id: item.documentId,
      type: item.type,
      text: item.text,
      page_number: item.pageNumber,
      embed_data: JSON.stringify(item.embedData),
      kind: item.kind || "annotation",
      context: item.context ?? null,
      created_at: item.createdAt,
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

  manualDialogOpen: false,
  openManualDialog: () => set({ manualDialogOpen: true }),
  closeManualDialog: () => set({ manualDialogOpen: false }),

  setItems: (items) => set({ items }),
  addItem: (item) => {
    persistAnnotation(item);
    if (item.aiResult) {
      window.siltflow.aiResults
        .save(item.id, item.documentId, item.aiResult, item.aiVersion ?? 2)
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
    // Append (newest last): PdfViewer re-sorts by z-order before rendering,
    // so the store order is not what determines DOM stacking. Appending keeps
    // a freshly-added item at the tail (topmost layer) until the re-sort runs.
    set((s) => ({ items: [...s.items, item] }));
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
      // When aiResult is set (not null, not deletion), default the version to 2
      // (the current schema). V2 callers that only mutate existing V2 data
      // (e.g. text edits syncing input.normalized) may omit aiVersion — without
      // this default their patch would stomp a V2 card to an undefined version.
      if (patch.aiResult && patch.aiResult !== null) {
        patch.aiVersion ??= 2;
      }
      const merged = { ...current, ...patch };
      // Always persist the annotation core
      persistAnnotation(merged);
      // Persist side tables if changed
      if (patch.aiResult !== undefined) {
        // Current schema is V2 — fall back to it when the caller omits a version
        // so V2 data survives app refresh (the IPC previously always wrote version=1).
        const saveVersion = patch.aiVersion ?? 2;
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
