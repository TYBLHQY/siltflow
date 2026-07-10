import { create } from "zustand"
import type { ScaledPosition, Content } from "react-pdf-highlighter-plus"
import type { AIAnnotationData } from "@/lib/annotation-types"
import type { Card } from "ts-fsrs"

export interface AnnotationEmbedData {
  position: ScaledPosition
  content?: Content
}

export interface AnnotationItem {
  id: string
  documentId: string
  type: string
  text: string
  /** 1-indexed page number, consistent with react-pdf-highlighter-plus */
  pageNumber: number
  embedData: AnnotationEmbedData
  /** AI analysis result — populated after translation request completes */
  aiResult?: AIAnnotationData | null
  /** FSRS card state — set when first reviewed */
  fsrsCard?: Card
}

interface AnnotationState {
  items: AnnotationItem[]
  setItems: (items: AnnotationItem[]) => void
  addItem: (item: AnnotationItem) => void
  removeItem: (id: string) => void
  updateItem: (id: string, patch: Partial<AnnotationItem>) => void
  clear: () => void
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  items: [],

  setItems: (items) => set({ items }),
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),

  removeItem: (id) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

  updateItem: (id, patch) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    })),

  clear: () => set({ items: [] }),
}))
