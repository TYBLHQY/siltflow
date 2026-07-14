import { create } from "zustand";

export interface DocumentItem {
  id: string;
  title: string;
  totalPages?: number | null;
  folderId?: string | null;
  sortOrder?: number;
}

interface DocumentState {
  documents: DocumentItem[];
  currentDocument: DocumentItem | null;
  loading: boolean;
  loaded: boolean;
  addDocument: (doc: DocumentItem) => void;
  addDocuments: (docs: DocumentItem[]) => void;
  updateDocument: (id: string, patch: Partial<DocumentItem>) => void;
  setCurrentDocument: (doc: DocumentItem | null) => void;
  removeDocument: (id: string) => void;
  setDocuments: (docs: DocumentItem[]) => void;
  loadFromDb: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  currentDocument: null,
  loading: false,
  loaded: false,

  addDocument: (doc) =>
    set((state) => ({
      documents: [...state.documents, doc],
    })),
  addDocuments: (docs) =>
    set((state) => ({
      documents: [...state.documents, ...docs],
    })),
  updateDocument: (id, patch) =>
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === id ? { ...d, ...patch } : d,
      ),
      currentDocument:
        state.currentDocument?.id === id
          ? { ...state.currentDocument, ...patch }
          : state.currentDocument,
    })),

  setCurrentDocument: (doc) => set({ currentDocument: doc }),

  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      currentDocument:
        state.currentDocument?.id === id ? null : state.currentDocument,
    })),

  setDocuments: (docs) => set({ documents: docs }),

  loadFromDb: async () => {
    if (get().loaded) return;
    set({ loading: true });
    try {
      const { executeSql } = await import("../database");
      const docs = await executeSql("SELECT * FROM documents ORDER BY sort_order ASC");
      set({ documents: docs || [], loaded: true });
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      set({ loading: false });
    }
  },

  setLoading: (loading) => set({ loading }),
}));
