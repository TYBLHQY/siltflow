import { create } from "zustand"

export interface DocumentItem {
  id: string
  title: string
  filePath: string
}

interface DocumentState {
  documents: DocumentItem[]
  currentDocument: DocumentItem | null
  addDocument: (doc: DocumentItem) => void
  setCurrentDocument: (doc: DocumentItem | null) => void
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  currentDocument: null,
  addDocument: (doc) =>
    set((state) => ({
      documents: [...state.documents, doc],
    })),
  setCurrentDocument: (doc) => set({ currentDocument: doc }),
}))
