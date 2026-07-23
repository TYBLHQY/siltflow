/**
 * Review log store — mirrors desktop `stores/review-log.store.ts`.
 */

import { create } from "zustand";
import { getSQLite } from "@/stores/db.store";
import {
  listReviewLogsByAnnotation,
  saveReviewLog,
} from "@/services/review-logs.service";
import type { ReviewLogEntryIPC } from "@/services/types";

interface ReviewLogState {
  /** logs keyed by annotationId */
  logs: Record<string, ReviewLogEntryIPC[]>;
  loading: boolean;

  loadForAnnotation: (annotationId: string, documentId: string) => void;
  addLog: (annotationId: string, documentId: string, data: unknown) => ReviewLogEntryIPC | null;
  clearAnnotation: (annotationId: string) => void;
}

export const useReviewLogStore = create<ReviewLogState>((set) => ({
  logs: {},
  loading: false,

  loadForAnnotation: (annotationId, documentId) => {
    set({ loading: true });
    try {
      const db = getSQLite();
      const entries = listReviewLogsByAnnotation(db, annotationId, documentId);
      set((s) => ({
        logs: { ...s.logs, [annotationId]: entries },
      }));
    } catch (err) {
      console.error("[review-log.store] loadForAnnotation failed:", err);
    } finally {
      set({ loading: false });
    }
  },

  addLog: (annotationId, documentId, data) => {
    try {
      const db = getSQLite();
      const result = saveReviewLog(db, annotationId, documentId, data);
      const entry: ReviewLogEntryIPC = {
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
      return entry;
    } catch (err) {
      console.error("[review-log.store] addLog failed:", err);
      return null;
    }
  },

  clearAnnotation: (annotationId) => {
    set((s) => {
      const next = { ...s.logs };
      delete next[annotationId];
      return { logs: next };
    });
  },
}));
