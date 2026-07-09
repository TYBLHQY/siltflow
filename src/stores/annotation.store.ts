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
  setItems: (items: AnnotationItem[]) => void
  addItem: (item: AnnotationItem) => void
  removeItem: (id: string) => void
  clear: () => void
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (id) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [] }),
}))
