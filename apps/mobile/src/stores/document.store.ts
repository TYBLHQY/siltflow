/**
 * Document store — mirrors desktop `stores/document.store.ts`.
 *
 * Uses Drizzle-based document service instead of window.siltflow IPC.
 */

import { create } from "zustand";
import { getDrizzle } from "@/stores/db.store";
import {
  listDocuments,
  saveDocument,
  deleteDocument,
} from "@/services/documents.service";

export interface DocumentItem {
  id: string;
  title: string;
  totalPages?: number | null;
  originalName?: string | null;
  folderId?: string | null;
  sortOrder?: number;
  metadata?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DocumentState {
  documents: DocumentItem[];
  currentDocument: DocumentItem | null;
  loading: boolean;
  loaded: boolean;

  setDocuments: (docs: DocumentItem[]) => void;
  addDocument: (doc: DocumentItem) => void;
  updateDocument: (id: string, patch: Partial<DocumentItem>) => void;
  setCurrentDocument: (doc: DocumentItem | null) => void;
  removeDocument: (id: string) => void;

  loadFromDb: () => void;
  setLoading: (loading: boolean) => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  currentDocument: null,
  loading: false,
  loaded: false,

  setDocuments: (docs) => set({ documents: docs }),

  addDocument: (doc) =>
    set((s) => ({ documents: [...s.documents, doc] })),

  updateDocument: (id, patch) =>
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, ...patch } : d,
      ),
      currentDocument:
        s.currentDocument?.id === id
          ? { ...s.currentDocument, ...patch }
          : s.currentDocument,
    })),

  setCurrentDocument: (doc) => set({ currentDocument: doc }),

  removeDocument: (id) =>
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== id),
      currentDocument:
        s.currentDocument?.id === id ? null : s.currentDocument,
    })),

  loadFromDb: () => {
    if (get().loaded) return;
    set({ loading: true });
    try {
      const db = getDrizzle();
      const docs = listDocuments(db);
      set({ documents: docs, loaded: true });
    } catch (err) {
      console.error("[document.store] loadFromDb failed:", err);
    } finally {
      set({ loading: false });
    }
  },

  setLoading: (loading) => set({ loading }),
}));

// ── Action helpers (called from components / other stores) ──────────

export function persistDocument(doc: DocumentItem) {
  try {
    const db = getDrizzle();
    saveDocument(db, { id: doc.id, title: doc.title });
  } catch (err) {
    console.error("[document.store] persistDocument failed:", err);
  }
}

export function persistDocumentDelete(id: string) {
  try {
    const db = getDrizzle();
    deleteDocument(db, id);
  } catch (err) {
    console.error("[document.store] persistDocumentDelete failed:", err);
  }
}
