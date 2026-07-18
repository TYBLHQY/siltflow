import { useCallback, useState, useEffect, useRef } from "react";
import { useStyleStore } from "@/stores/style.store";
import {
  PdfLoader,
  PdfHighlighter,
} from "react-pdf-highlighter-plus";
import type {
  Highlight as RPHLHighlight,
  PdfSelection,
  GhostHighlight,
  PdfHighlighterUtils,
  PdfScaleValue,
} from "react-pdf-highlighter-plus";
import {
  useAnnotationStore,
  type AnnotationItem,
} from "@/stores/annotation.store";
import { usePdfViewerStore, registerGoToPage, registerScrollToHighlight, registerSetViewerScale } from "@/stores/pdf-viewer.store";
import { useDocumentStore } from "@/stores/document.store";
import type { AIAnnotationDataV2 } from "@/types/annotation";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import "react-pdf-highlighter-plus/style/style.css";
import "react-pdf-highlighter-plus/style/pdf_viewer.css";
import { SiltflowHighlightContainer } from "./SiltflowHighlightContainer";
import { SelectionTip } from "./SelectionTip";

// ---------------------------------------------------------------------------
// SiltflowHighlight — our application-specific highlight extension
// ---------------------------------------------------------------------------
export interface SiltflowHighlight extends RPHLHighlight {
  /** User-facing comment string. */
  comment?: string;
  /** Text-highlight background color. */
  highlightColor?: string;
  /** Source language from the annotation's AI result (BCP 47). */
  sourceLang?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert an AnnotationItem (from store / Electron IPC) into a SiltflowHighlight
 * that the PdfHighlighter can render.
 *
 * NOTE: `position` is stored as a ScaledPosition in embedData.
 * pageNumber in ScaledPosition is 1-indexed. We keep it as-is — always 1-indexed
 * everywhere except in display rendering (LeftPanel/RightPanel).
 */
function annotationToHighlight(item: AnnotationItem): SiltflowHighlight {
  const embed = item.embedData as AnnotationItem["embedData"];
  // Source language: prefer the annotation's own AI result (same as card TTS),
  // fall back to the item's text language if available.
  const ai = item.aiResult as AIAnnotationDataV2 | undefined;
  return {
    id: item.id,
    type: (item.type as SiltflowHighlight["type"]) || "text",
    content: embed?.content ?? { text: item.text },
    position: embed?.position ?? {
      boundingRect: {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        width: 0,
        height: 0,
        pageNumber: item.pageNumber,
      },
      rects: [],
    },
    comment: "",
    sourceLang: ai?.input?.source_lang,
  };
}

/**
 * Build an AnnotationItem from a completed selection.
 * pageNumber is taken from the ScaledPosition (1-indexed) and stored as-is.
 */
function selectionToAnnotation(
  id: string,
  documentId: string,
  ghost: GhostHighlight,
): AnnotationItem {
  const pageNumber = ghost.position.boundingRect.pageNumber ?? 1;
  return {
    id,
    documentId,
    type: ghost.type || "highlight",
    text: ghost.content?.text ?? "",
    pageNumber,
    embedData: {
      position: ghost.position,
      content: ghost.content,
    },
  };
}

// ---------------------------------------------------------------------------
// PdfViewer component
// ---------------------------------------------------------------------------

interface PdfViewerProps {
  src: string;
  documentId: string;
  className?: string;
}

export function PdfViewer({ src, documentId, className }: PdfViewerProps) {
  const storeItems = useAnnotationStore((s) => s.items);
  const addItem = useAnnotationStore((s) => s.addItem);
  const removeItem = useAnnotationStore((s) => s.removeItem);
  const quickAddEnabled = usePdfViewerStore((s) => s.quickAddEnabled);
  const setPendingAnnotation = usePdfViewerStore((s) => s.setPendingAnnotation);
  const [highlights, setHighlights] = useState<SiltflowHighlight[]>(() =>
    storeItems.map(annotationToHighlight),
  );
  // Ref always pointing to the current highlights array, so callbacks captured
  // in utilsRef can find the latest highlights even after new ones are added.
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;

  // Sync from store -> component state whenever store items change.
  // Also triggers when store items identity changes (after delete/add).
  useEffect(() => {
    setHighlights(storeItems.map(annotationToHighlight));
  }, [storeItems]);

  /**
   * When user finishes a text/area selection, create a new highlight:
   * 1. Convert the selection to an AnnotationItem
   * 2. If quick-add: persist + add immediately
   * 3. If not quick-add: store as pending, show selection tip
   *
   * We do NOT call selection.makeGhostHighlight() because that creates a
   * temporary ghost overlay that blocks interaction with the permanent
   * highlight underneath. Instead we update the highlights array directly
   * and let the library's useEffect + renderHighlightLayers pick it up.
   */
  const handleSelection = useCallback(
    (selection: PdfSelection) => {
      const id = crypto.randomUUID();
      // Build the ghost object WITHOUT calling makeGhostHighlight (which
      // would modify library internal state and block the permanent highlight).
      const ghost: GhostHighlight = {
        type: "text",
        content: selection.content,
        position: selection.position,
      };
      const cleanedText = (ghost.content?.text ?? "").replace(/\n/g, " ");
      const pageNumber = ghost.position.boundingRect.pageNumber ?? 1;
      const item = selectionToAnnotation(id, documentId, {
        ...ghost,
        content: ghost.content
          ? { ...ghost.content, text: cleanedText }
          : undefined,
      } as GhostHighlight);

      if (quickAddEnabled) {
        // Quick-add: persist immediately (addItem persists via annotation.store)
        setHighlights((prev) => [...prev, annotationToHighlight(item)]);
        addItem(item);
        window.getSelection()?.removeAllRanges();
      } else {
        // Manual mode: store pending, show tip
        setPendingAnnotation({
          text: cleanedText,
          pageNumber,
          position: item.embedData.position,
        });
      }
    },
    [documentId, quickAddEnabled, addItem, setPendingAnnotation],
  );

  /**
   * Delete a highlight:
   * 1. Delete from Electron backend (IPC)
   * 2. Remove from Zustand store
   */
  const deleteHighlight = useCallback(
    (id: string) => {
      removeItem(id);
    },
    [removeItem],
  );

  // Clean up store state when documentId changes
  // NOTE: only clean pdfDocument and scroll helpers, NOT goToPage — the
  // library's utilsRef only fires ONCE (guarded by an internal ref), so
  // cleaning it in StrictMode's unmount/remount cycle would leave it null forever.
  // Also skip pdfDocument cleanup — React.lazy + strict effects can cause a
  // double-load cycle (setPdfDocument(null) → new mount triggers another load).
  useEffect(() => {
    return () => {
      registerScrollToHighlight(null);
    };
  }, [documentId]);

  return (
    <div className={className}>
      <PdfLoader
        document={src}
        workerSrc={pdfjsWorkerUrl}
        beforeLoad={() => (
          <div className="flex items-center justify-center h-full text-ctp-overlay0 text-sm">
            Loading PDF...
          </div>
        )}
        errorMessage={() => (
          <div className="flex items-center justify-center h-full text-ctp-red text-sm">
            Failed to load PDF
          </div>
        )}
        onError={() => {
          // If the PDF fails to load (e.g. file was deleted externally),
          // close the current document.
          useDocumentStore.getState().setCurrentDocument(null);
        }}
      >
        {(pdfDocument) => (
          <PdfHighlighterWrapper
            pdfDocument={pdfDocument}
            documentId={documentId}
            highlights={highlights}
            highlightsRef={highlightsRef}
            onSelection={handleSelection}
            deleteHighlight={deleteHighlight}
            onHighlightClick={(id: string) => {
              window.dispatchEvent(
                new CustomEvent("siltflow:annotation-click", { detail: { id } }),
              );
            }}
          />
        )}
      </PdfLoader>
    </div>
  );
}

/** Wraps PdfHighlighter, syncing PDF state to the shared store. */
function PdfHighlighterWrapper({
  pdfDocument,
  documentId,
  highlights,
  highlightsRef,
  onSelection,
  deleteHighlight,
  onHighlightClick,
}: {
  pdfDocument: PDFDocumentProxy;
  documentId: string;
  highlights: SiltflowHighlight[];
  highlightsRef: React.MutableRefObject<SiltflowHighlight[]>;
  onSelection: (selection: PdfSelection) => void;
  deleteHighlight: (id: string) => void;
  onHighlightClick?: (id: string) => void;
}) {
  const setPdfDocument = usePdfViewerStore((s) => s.setPdfDocument);
  const setCurrentPage = usePdfViewerStore((s) => s.setCurrentPage);
  const setPdfScale = usePdfViewerStore((s) => s.setPdfScale);
  const pdfScale = usePdfViewerStore((s) => s.pdfScale);
  const fitWidth = usePdfViewerStore((s) => s.fitWidth);
  const lastPage = usePdfViewerStore((s) => s.lastPageByDocId[documentId]);
  const pdfScrollbar = useStyleStore((s) => s.style.pdfScrollbar);
  const setLastPage = usePdfViewerStore((s) => s.setLastPage);
  const quickAddEnabled = usePdfViewerStore((s) => s.quickAddEnabled);
  const updateDoc = useDocumentStore((s) => s.updateDocument);

  // Sync pdfDocument to store via effect
  useEffect(() => {
    setPdfDocument(pdfDocument);
  }, [pdfDocument, setPdfDocument]);

  // Save totalPages + metadata to DB and store when the PDF finishes loading
  useEffect(() => {
    const totalPages = pdfDocument.numPages;
    if (!totalPages) return;

    // Update local store immediately
    updateDoc(documentId, { totalPages });

    pdfDocument.getMetadata().then((meta) => {
      const metadata = JSON.stringify(meta);
      window.siltflow.documents.updateMetadata({
        id: documentId,
        totalPages,
        metadata,
      });
    });
  }, [pdfDocument, documentId, updateDoc]);

  // Example pattern: pdfScaleValue is always numeric (or undefined = auto).

  // When fitWidth is active, pass "page-width" so the built-in ResizeObserver
  // keeps applying it (otherwise undefined → "auto" overrides).
  const numScale = pdfScale > 0 ? pdfScale : undefined;
  const pdfScaleValue: PdfScaleValue | undefined = fitWidth
    ? "page-width"
    : numScale;

  const handleZoomChange = useCallback(
    (scale: number) => {
      if (fitWidth) return;
      setPdfScale(Math.round(scale * 100) / 100);
    },
    [fitWidth, setPdfScale],
  );

  /** Render a floating "Add annotation" tip after selection in non-quick-add mode. */
  const selectionTipContent = !quickAddEnabled ? <SelectionTip /> : undefined;

  // ── Middle-click pan (non-auto zoom mode) ──
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    scrollEl: HTMLElement;
  } | null>(null);

  // Disable text selection during pan
  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const onDragStart = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      const scrollEl = el.querySelector<HTMLElement>(".PdfHighlighter");
      if (!scrollEl) return;

      // Grab cursor
      scrollEl.style.cursor = "grabbing";
      scrollEl.style.userSelect = "none";

      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: scrollEl.scrollLeft,
        scrollTop: scrollEl.scrollTop,
        scrollEl,
      };

      const onMove = (ev: MouseEvent) => {
        const p = panRef.current;
        if (!p) return;
        // horizontal scroll disabled — pan is vertical-only
        p.scrollEl.scrollTop = p.scrollTop - (ev.clientY - p.startY);
        ev.preventDefault();
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        if (panRef.current) {
          panRef.current.scrollEl.style.cursor = "";
          panRef.current.scrollEl.style.userSelect = "";
          panRef.current = null;
        }
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };

    el.addEventListener("mousedown", onDragStart);
    return () => el.removeEventListener("mousedown", onDragStart);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="h-full w-full"
      data-pdf-scrollbar={pdfScrollbar ? "true" : "false"}
    >
      <PdfHighlighter
        pdfDocument={pdfDocument}
        highlights={highlights}
        key={documentId}
        onSelection={onSelection}
        selectionTip={selectionTipContent}
        utilsRef={(utils: PdfHighlighterUtils) => {
          registerGoToPage((pageNumber: number) => utils.goToPage(pageNumber));

          // Unlock canvas resolution cap so page-width and zoomed views
          // render at full device resolution instead of CSS-only zoom.
          const viewer = utils.getViewer();
          if (viewer) viewer.maxCanvasPixels = -1;

          // Capture a raw scale setter so FitWidthButton/Settings can call
          // viewer.currentScaleValue = "page-width" directly.
          registerSetViewerScale((value: string) => {
            if (viewer) viewer.currentScaleValue = value;
          });

          // Expose scrollToHighlight so RightPanel can call it
          // Use a ref so the closure always sees the latest highlights array.
          registerScrollToHighlight((id: string) => {
            // Build a minimal Highlight object from the id since scrollToHighlight
            // needs the full position data. Find in the ref that stays current.
            const h = highlightsRef.current.find((h) => h.id === id);
            if (h) {
              utils.scrollToHighlight(h);
            }
          });
        }}
        onPageChange={(page: number) => {
          setCurrentPage(page);
          setLastPage(documentId, page);
        }}
        onZoomChange={handleZoomChange}
        pdfScaleValue={pdfScaleValue}
        initialPage={lastPage && lastPage > 1 ? lastPage : undefined}
        style={{ height: "100%" }}
      >
        <SiltflowHighlightContainer
          deleteHighlight={deleteHighlight}
          onHighlightClick={onHighlightClick}
        />
      </PdfHighlighter>
    </div>
  );
}
