import { create } from "zustand";
import { usePdfViewerStore } from "./pdf-viewer.store";

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

  // Switching documents must reset pdfScale BEFORE any viewer render reads it.
  // The library's handleScaleValue effect applies pdfScaleValue to the viewer
  // as soon as it's ready (isViewerReady), but pdf.js hasn't built `_pages`
  // yet — so a numeric scale left over from the previous document hits
  // `scrollPageIntoView({pageNumber: 1})` on an empty array and logs
  // "not a valid pageNumber". Reset here (synchronous, on the event path that
  // triggers the switch, before the new keyed PdfHighlighter mounts and its
  // effects run) so the new viewer falls back to "auto" until pages exist;
  // applyFitWidthScale then recomputes the fit-width scale once they do.
  setCurrentDocument: (doc) => {
    usePdfViewerStore.getState().setPdfScale(0);
    set({ currentDocument: doc });
  },

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
      const docs = await window.siltflow.documents.list();
      set({ documents: docs || [], loaded: true });
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      set({ loading: false });
    }
  },

  setLoading: (loading) => set({ loading }),
}));
