import { create } from "zustand"

export interface AnnotationItem {
  id: string
  documentId: string
  type: string
  text: string
  pageNumber: number
  embedData: unknown
}

interface AnnotationState {
  items: AnnotationItem[]
  pendingDeletes: { id: string; pageNumber: number }[]
  setItems: (items: AnnotationItem[]) => void
  addItem: (item: AnnotationItem) => void
  removeItem: (id: string) => void
  queueDelete: (id: string, pageNumber: number) => void
  clearDeletes: () => void
  clear: () => void
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  items: [],
  pendingDeletes: [],

  setItems: (items) => set({ items }),
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),

  removeItem: (id) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

  queueDelete: (id, pageNumber) =>
    set((s) => ({
      pendingDeletes: [...s.pendingDeletes, { id, pageNumber }],
    })),

  clearDeletes: () => set({ pendingDeletes: [] }),
  clear: () => set({ items: [], pendingDeletes: [] }),
}))
