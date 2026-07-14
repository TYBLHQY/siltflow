import { create } from "zustand";

export interface ReviewLogEntry {
  id: string;
  annotationId: string;
  documentId: string;
  data: string;
  createdAt: string;
}

export interface ReviewLogData {
  rating: number;
  state: number;
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  review: string;
}

export interface CardSnapshot {
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
}

export interface ReviewLogSaveRequest {
  log: ReviewLogData;
  card: CardSnapshot;
  grade: number;
}

interface ReviewLogStoreState {
  logs: Record<string, ReviewLogEntry[]>;
  activeHistoryId: string | null;
  setActiveHistoryId: (id: string | null) => void;
  load: (annotationId: string, documentId: string) => Promise<void>;
  add: (
    annotationId: string,
    documentId: string,
    data: ReviewLogSaveRequest,
  ) => Promise<void>;
  clearAnnotation: (annotationId: string) => void;
}

export const useReviewLogStore = create<ReviewLogStoreState>((set) => ({
  logs: {},
  activeHistoryId: null,

  setActiveHistoryId: (id) => set({ activeHistoryId: id }),

  load: async (annotationId, documentId) => {
    const { executeSql } = await import("../database");
    const rows = await executeSql(
      "SELECT * FROM review_logs WHERE annotation_id = ? AND document_id = ? ORDER BY created_at DESC",
      [annotationId, documentId],
    );
    const entries: ReviewLogEntry[] = rows.map((r: any) => ({
      id: r.id,
      annotationId: r.annotation_id,
      documentId: r.document_id,
      data: r.data,
      createdAt: r.created_at,
    }));
    set((s) => ({
      logs: { ...s.logs, [annotationId]: entries },
    }));
  },

  add: async (annotationId, documentId, data) => {
    const { runSql } = await import("../database");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await runSql(
      "INSERT INTO review_logs (id, annotation_id, document_id, data, created_at) VALUES (?, ?, ?, ?, ?)",
      [id, annotationId, documentId, JSON.stringify(data), now],
    );
    const entry: ReviewLogEntry = {
      id,
      annotationId,
      documentId,
      data: JSON.stringify(data),
      createdAt: now,
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
