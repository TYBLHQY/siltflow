import { create } from "zustand";
import type { ReviewLogEntry, ReviewLogSaveRequest } from "@/types/review";
export type { ReviewLogEntry, ReviewLogData, CardSnapshot, ReviewLogSaveRequest } from "@/types/review";

interface ReviewLogStoreState {
  /** Logs keyed by annotationId, cached after load */
  logs: Record<string, ReviewLogEntry[]>;
  /** ID of the annotation whose review history is currently expanded (null = collapsed) */
  activeHistoryId: string | null;
  /** Set which annotation's history is expanded (pass null to collapse all) */
  setActiveHistoryId: (id: string | null) => void;
  /** Load logs for an annotation from IPC */
  load: (annotationId: string, documentId: string) => Promise<void>;
  /** Add a new log entry (save IPC + prepend to cache) */
  add: (
    annotationId: string,
    documentId: string,
    data: ReviewLogSaveRequest,
  ) => Promise<void>;
  /** Remove cached logs for an annotation */
  clearAnnotation: (annotationId: string) => void;
}

export const useReviewLogStore = create<ReviewLogStoreState>((set) => ({
  logs: {},
  activeHistoryId: null,

  setActiveHistoryId: (id) => set({ activeHistoryId: id }),

  load: async (annotationId, documentId) => {
    const entries = await window.siltflow.reviewLogs.listByAnnotation(
      annotationId,
      documentId,
    );
    set((s) => ({
      logs: { ...s.logs, [annotationId]: entries },
    }));
  },

  add: async (annotationId, documentId, data) => {
    const result = await window.siltflow.reviewLogs.save(
      annotationId,
      documentId,
      data,
    );
    if (!result) return;
    const entry: ReviewLogEntry = {
      id: result.id,
      annotationId,
      documentId,
      data: JSON.stringify(data),
      createdAt: result.createdAt,
    };
    set((s) => ({
      logs: {
        ...s.logs,
        [annotationId]: [entry, ...(s.logs[annotationId] ?? [])],
      },
    }));
  },

  clearAnnotation: (annotationId) => {
    set((s) => {
      const next = { ...s.logs };
      delete next[annotationId];
      return { logs: next };
    });
  },
}));
