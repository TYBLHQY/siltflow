import { create } from "zustand"
import type { PDFDocumentProxy } from "pdfjs-dist"

interface PdfViewerState {
  /** The current PDF document proxy (null when none loaded) */
  pdfDocument: PDFDocumentProxy | null
  /** Set the PDF document proxy (called from PdfViewer) */
  setPdfDocument: (doc: PDFDocumentProxy | null) => void

  /** Navigate to a specific page (1-indexed) */
  goToPage: ((pageNumber: number) => void) | null
  /** Set the goToPage callback (called from PdfViewer via utilsRef) */
  setGoToPage: (fn: ((pageNumber: number) => void) | null) => void

  /** Current visible page (1-indexed) */
  currentPage: number
  /** Set current page */
  setCurrentPage: (page: number) => void
}

export const usePdfViewerStore = create<PdfViewerState>((set) => ({
  pdfDocument: null,
  setPdfDocument: (doc) => set({ pdfDocument: doc }),

  goToPage: null,
  setGoToPage: (fn) => set({ goToPage: fn }),

  currentPage: 1,
  setCurrentPage: (page) => set({ currentPage: page }),
}))
