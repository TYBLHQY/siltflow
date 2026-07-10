import { create } from "zustand"
import type { PDFDocumentProxy } from "pdfjs-dist"

interface PdfViewerState {
  /** The current PDF document proxy (null when none loaded) */
  pdfDocument: PDFDocumentProxy | null
  setPdfDocument: (doc: PDFDocumentProxy | null) => void

  /** Navigate to a specific page */
  goToPage: ((pageNumber: number) => void) | null
  setGoToPage: (fn: ((pageNumber: number) => void) | null) => void

  /** Current visible page (1-indexed) */
  currentPage: number
  setCurrentPage: (page: number) => void

  /**
   * Numeric PDF scale / zoom.  0 means "auto" (no user zoom applied yet).
   * Always stored as a number so the library's proximity check can skip
   * re-applying on highlight-caused re-renders.
   */
  pdfScale: number
  setPdfScale: (v: number) => void

  /** Whether fit-to-width mode is active */
  fitWidth: boolean
  setFitWidth: (v: boolean) => void

  /**
   * Direct setter for the PDF viewer's currentScaleValue.
   * Captured once from utilsRef so FitWidthButton / Settings can bypass
   * the prop-based pdfScaleValue (which is always numeric).
   */
  setViewerScale: ((value: string) => void) | null
  setSetViewerScale: (fn: ((value: string) => void) | null) => void

  /** Scroll to a highlight by id — set from RightPanel/LeftPanel */
  scrollToHighlight: ((id: string) => void) | null
  setScrollToHighlight: (fn: ((id: string) => void) | null) => void

  /** The id of the highlight that was just scrolled to (for highlighting in the sidebar) */
  scrolledHighlightId: string | null
  setScrolledHighlightId: (id: string | null) => void
}

export const usePdfViewerStore = create<PdfViewerState>((set) => ({
  pdfDocument: null,
  setPdfDocument: (doc) => set({ pdfDocument: doc }),

  goToPage: null,
  setGoToPage: (fn) => set({ goToPage: fn }),

  currentPage: 1,
  setCurrentPage: (page) => set({ currentPage: page }),

  pdfScale: 0,
  setPdfScale: (v) => set({ pdfScale: v }),

  fitWidth: false,
  setFitWidth: (v) => set({ fitWidth: v }),

  setViewerScale: null,
  setSetViewerScale: (fn) => set({ setViewerScale: fn }),

  scrollToHighlight: null,
  setScrollToHighlight: (fn) => set({ scrollToHighlight: fn }),

  scrolledHighlightId: null,
  setScrolledHighlightId: (id) => set({ scrolledHighlightId: id }),
}))
