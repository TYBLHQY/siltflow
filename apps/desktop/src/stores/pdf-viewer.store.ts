import { create } from "zustand";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { debounce } from "@/lib/utils";

/**
 * Module-level refs for PDF viewer callbacks (goToPage, scrollToHighlight,
 * setViewerScale). These are not Zustand state — they're impure functions
 * registered by the PdfViewer component on mount and consumed by layout/
 * document panels. Using refs avoids serialization issues, devtools noise,
 * and the anti-pattern of storing functions in Zustand state.
 */
const _goToPage: { current: ((pageNumber: number) => void) | null } = {
  current: null,
};
const _scrollToHighlight: { current: ((id: string) => void) | null } = {
  current: null,
};
const _setViewerScale: { current: ((value: string) => void) | null } = {
  current: null,
};

/** Register a goToPage callback. Called once from PdfViewer on mount. */
export function registerGoToPage(fn: typeof _goToPage.current) {
  _goToPage.current = fn;
}

/** Register a scrollToHighlight callback. Called once from PdfViewer on mount. */
export function registerScrollToHighlight(
  fn: typeof _scrollToHighlight.current,
) {
  _scrollToHighlight.current = fn;
}

/** Register a setViewerScale callback. Called once from PdfViewer on mount. */
export function registerSetViewerScale(
  fn: typeof _setViewerScale.current,
) {
  _setViewerScale.current = fn;
}

/** Go to a specific PDF page (may be no-op if viewer not yet mounted). */
export function pdfGoToPage(pageNumber: number) {
  _goToPage.current?.(pageNumber);
}

/** Scroll to a highlight by annotation id (may be no-op if viewer not yet mounted). */
export function pdfScrollToHighlight(id: string) {
  _scrollToHighlight.current?.(id);
}

/** Set viewer scale (e.g. "auto", "page-width"). */
export function pdfSetViewerScale(value: string) {
  _setViewerScale.current?.(value);
}

// ── SelectionMode ─────────────────────────────────────────────────────────

/** Three-way selection mode for PDF text selection. */
export type SelectionMode = "manual" | "auto-annotate" | "auto-highlight";

const ALL_MODES: SelectionMode[] = ["manual", "auto-annotate", "auto-highlight"];

// ── Store ──────────────────────────────────────────────────────────────────

interface PdfViewerState {
  /** The current PDF document proxy (null when none loaded) */
  pdfDocument: PDFDocumentProxy | null;
  setPdfDocument: (doc: PDFDocumentProxy | null) => void;

  /** Current visible page (1-indexed) */
  currentPage: number;
  setCurrentPage: (page: number) => void;

  /**
   * Numeric PDF scale / zoom.  0 means "auto" (no user zoom applied yet).
   * Always stored as a number so the library's proximity check can skip
   * re-applying on highlight-caused re-renders.
   */
  pdfScale: number;
  setPdfScale: (v: number) => void;

  /** Whether fit-to-width mode is active */
  fitWidth: boolean;
  setFitWidth: (v: boolean) => void;

  /** Last-read page per document ID (persisted to vault config) */
  lastPageByDocId: Record<string, number>;
  setLastPage: (docId: string, page: number) => void;

  /**
   * Selection mode: manual (shows SelectionTip), auto-annotate (immediate
   * annotation), or auto-highlight (immediate plain highlight).
   */
  selectionMode: SelectionMode;
  setSelectionMode: (v: SelectionMode) => void;

  /** Pending ghost annotation info (null = nothing pending) */
  pendingAnnotation: {
    text: string;
    pageNumber: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    position: any;
  } | null;
  setPendingAnnotation: (
    ann: { text: string; pageNumber: number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      position: any; } | null,
  ) => void;
}

export const usePdfViewerStore = create<PdfViewerState>((set) => ({
  pdfDocument: null,
  setPdfDocument: (doc) => set({ pdfDocument: doc }),

  currentPage: 1,
  setCurrentPage: (page) => set({ currentPage: page }),

  pdfScale: 0,
  setPdfScale: (v) => set({ pdfScale: v }),

  fitWidth: true,
  setFitWidth: (v) => set({ fitWidth: v }),

  lastPageByDocId: {},
  setLastPage: (docId, page) =>
    set((s) => {
      const next = { ...s.lastPageByDocId, [docId]: page };
      debouncedSetLastPages(next);
      return { lastPageByDocId: next };
    }),

  selectionMode: "auto-annotate",
  setSelectionMode: (v) =>
    set(() => {
      debouncedSetSelectionMode(v);
      return { selectionMode: v };
    }),

  pendingAnnotation: null,
  setPendingAnnotation: (ann) => set({ pendingAnnotation: ann }),
}));

const debouncedSetLastPages = debounce((lastPages: Record<string, number>) => {
  window.siltflow.vaultConfigSet({ lastPages });
}, 500);

const debouncedSetSelectionMode = debounce((v: SelectionMode) => {
  window.siltflow.vaultConfigSet({ selectionMode: v });
}, 500);

/** Load persisted last-page map and selection mode from vault (call once on app boot). */
export async function loadLastPages(cfg?: Record<string, unknown>) {
  try {
    if (!cfg) cfg = await window.siltflow.vaultConfigGet();

    const lastPages = (cfg as Record<string, unknown>).lastPages as
      Record<string, number> | undefined;
    if (lastPages && typeof lastPages === "object") {
      usePdfViewerStore.setState({ lastPageByDocId: lastPages });
    }

    // Migrate from old quickAddEnabled (boolean) or use new selectionMode (string)
    const selMode = (cfg as Record<string, unknown>).selectionMode;
    if (
      typeof selMode === "string" &&
      ALL_MODES.includes(selMode as SelectionMode)
    ) {
      usePdfViewerStore.setState({ selectionMode: selMode as SelectionMode });
    } else {
      // Fallback: migrate old quickAddEnabled boolean
      const quickAdd = (cfg as Record<string, unknown>).quickAddEnabled;
      if (typeof quickAdd === "boolean") {
        usePdfViewerStore.setState({
          selectionMode: quickAdd ? "auto-annotate" : "manual",
        });
      }
    }
  } catch {
    /* ignore */
  }
}
