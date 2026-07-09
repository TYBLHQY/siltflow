import { create } from "zustand"

export interface DocumentItem {
  id: string
  title: string
  filePath: string
}

interface DocumentState {
  documents: DocumentItem[]
  currentDocument: DocumentItem | null
  loading: boolean
  loaded: boolean
  addDocument: (doc: DocumentItem) => void
  setCurrentDocument: (doc: DocumentItem | null) => void
  loadFromDb: () => Promise<void>
  setLoading: (loading: boolean) => void
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

  setCurrentDocument: (doc) => set({ currentDocument: doc }),

  loadFromDb: async () => {
    if (get().loaded) return
    set({ loading: true })
    try {
      const docs = await window.siltflow.documents.list()
      set({ documents: docs || [], loaded: true })
    } catch (err) {
      console.error("Failed to load documents:", err)
    } finally {
      set({ loading: false })
    }
  },

  setLoading: (loading) => set({ loading }),
}))
