import { useCallback, useState, useEffect, useRef } from "react";
import { useStyleStore } from "@/stores/style.store";
import {
  PdfLoader,
  PdfHighlighter,
  type Highlight as RPHLHighlight,
  type PdfSelection,
  type GhostHighlight,
  type PdfHighlighterUtils,
  type PdfScaleValue,
} from "react-pdf-highlighter-plus";
import {
  useAnnotationStore,
  type AnnotationItem,
} from "@/stores/annotation.store";
import {
  usePdfViewerStore,
  registerGoToPage,
  registerScrollToHighlight,
} from "@/stores/pdf-viewer.store";
import { useDocumentStore } from "@/stores/document.store";
import { usePanelResizeState } from "@/hooks/usePanelResizeState";
import type { AIAnnotationDataV2 } from "@/types/annotation";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import "react-pdf-highlighter-plus/style/style.css";
import "react-pdf-highlighter-plus/style/pdf_viewer.css";
import { SiltflowHighlightContainer } from "./SiltflowHighlightContainer";
import { SelectionTip } from "./SelectionTip";
import { resolveHighlightCSSVar } from "@/lib/colors";
import { sortItemsForZOrder } from "@/lib/highlight-z-order";

// ---------------------------------------------------------------------------
// SiltflowHighlight — our application-specific highlight extension
// ---------------------------------------------------------------------------
export interface SiltflowHighlight extends RPHLHighlight {
  /** Whether this is an annotation, a plain visual highlight, or a manual card. */
  kind: "annotation" | "highlight" | "manual";
  /** User-facing comment string. */
  comment?: string;
  /** Text-highlight background color (CSS var() reference). */
  highlightColor?: string;
  /** Source language from the annotation's AI result (BCP 47). */
  sourceLang?: string;
  /** ISO timestamp from the backend (created_at), used for z-order tiebreaks. */
  createdAt?: string;
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
function annotationToHighlight(
  item: AnnotationItem,
  annotationColor: string,
  plainColor: string,
): SiltflowHighlight {
  const embed = item.embedData;
  // Source language: prefer the annotation's own AI result (same as card TTS),
  // fall back to the item's text language if available.
  const ai = item.aiResult as AIAnnotationDataV2 | undefined;
  const colorName = item.kind === "highlight" ? plainColor : annotationColor;
  return {
    id: item.id,
    kind: item.kind || "annotation",
    type: (item.type as SiltflowHighlight["type"]) ?? "text",
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
    highlightColor: resolveHighlightCSSVar(colorName),
    sourceLang: ai?.input?.source_lang,
    createdAt: item.createdAt,
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
  kind: "annotation" | "highlight" = "annotation",
): AnnotationItem {
  const pageNumber = ghost.position.boundingRect.pageNumber ?? 1;
  return {
    id,
    documentId,
    type: ghost.type || "highlight",
    kind,
    text: ghost.content?.text ?? "",
    pageNumber,
    embedData: {
      position: ghost.position,
      content: ghost.content,
    },
  };
}

// ---------------------------------------------------------------------------
// Scroll-to-highlight (ready-and-scroll)
//
// react-pdf-highlighter-plus's `scrollToHighlight` already handles far pages
// correctly: pdf.js keeps every `.page` div in the DOM (vertical scroll mode)
// with real geometry set from viewport math at construction, so the library's
// target computation is accurate even before a page is rasterised (verified by
// Playwright: a single call smooth-scrolls from page 1 to page 296 of a long
// PDF even when the target highlight layer isn't rendered yet).
//
// The real failure modes are *timing*:
//  - the target highlight may not be loaded yet (annotations load async from
//    Electron after a document switch), and
//  - the viewer may not be mounted yet.
// Both are silent no-ops if we scroll immediately. So we defer the scroll until
// the highlight exists in the ref AND the viewer is ready, polling briefly.
// ---------------------------------------------------------------------------

/** A deferred scroll-to-highlight waiting for the viewer and the highlight. */
interface QueuedScroll {
  highlightId: string;
  /** Captured with the utils instance so it always refers to the live viewer. */
  utils: PdfHighlighterUtils;
  /** Abort token — bumped on every navigation so superseded scrolls bail out. */
  token: number;
  pollId?: ReturnType<typeof setTimeout>;
  tries?: number;
}

let queuedScroll: QueuedScroll | null = null;
let scrollToken = 0;

const VIEWER_READY_POLL_INTERVAL_MS = 80;
const VIEWER_READY_MAX_TRIES = 40; // ~3.2s cap; drop the scroll rather than spin

/** Cancel any deferred scroll and its poll. */
function clearQueuedScroll(): void {
  if (!queuedScroll) return;
  if (queuedScroll.pollId) clearTimeout(queuedScroll.pollId);
  queuedScroll = null;
}

/**
 * Scroll to a highlight once it's loaded AND the viewer is ready — no jumps.
 * `highlightsRef` stays current, so we re-find the highlight each poll (it may
 * arrive after the annotation store finishes loading on a document switch).
 */
function scrollToHighlightWhenReady(
  highlightId: string,
  utils: PdfHighlighterUtils,
  highlightsRef: React.MutableRefObject<SiltflowHighlight[]>,
): void {
  scrollToken++;
  const token = scrollToken;
  clearQueuedScroll(); // rapid clicks don't stack

  const tryScroll = (): boolean => {
    const h = highlightsRef.current.find((hl) => hl.id === highlightId);
    if (!h) return false; // highlight not loaded yet
    if (!utils.getViewer()) return false; // viewer not mounted yet
    // The library's single call lands on the exact highlight (smooth) and sets
    // the accent-ring visual; it computes far-page targets from real geometry.
    utils.scrollToHighlight(h);
    return true;
  };

  // Already ready — scroll immediately (the common case: same-document jump).
  if (tryScroll()) return;

  // Highlight or viewer not ready (e.g. mid document switch / annotation load).
  queuedScroll = { highlightId, utils, token };
  const poll = () => {
    if (!queuedScroll || queuedScroll.token !== token) return;
    if (tryScroll()) {
      clearQueuedScroll();
      return;
    }
    queuedScroll.tries = (queuedScroll.tries ?? 0) + 1;
    if (queuedScroll.tries >= VIEWER_READY_MAX_TRIES) {
      clearQueuedScroll(); // never became ready — drop the deferred scroll
      return;
    }
    queuedScroll.pollId = setTimeout(poll, VIEWER_READY_POLL_INTERVAL_MS);
  };
  queuedScroll.pollId = setTimeout(poll, VIEWER_READY_POLL_INTERVAL_MS);
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
  const setPendingAnnotation = usePdfViewerStore((s) => s.setPendingAnnotation);

  // Read highlight color config from style store.
  // We read from getState() inside callbacks so we always get the latest value
  // without adding a subscription that re-renders on every color change.
  const getColors = useCallback(() => {
    const st = useStyleStore.getState().style;
    return {
      annotationColor: st.annotationHighlightColor || "yellow",
      plainColor: st.plainHighlightColor || "green",
    };
  }, []);

  const [highlights, setHighlights] = useState<SiltflowHighlight[]>(() => {
    const { annotationColor, plainColor } = getColors();
    return sortItemsForZOrder(storeItems)
      .filter((item) => item.kind !== "manual")
      .map((item) => annotationToHighlight(item, annotationColor, plainColor));
  });
  // Ref always pointing to the current highlights array, so callbacks captured
  // in utilsRef can find the latest highlights even after new ones are added.
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;

  // Sync from store -> component state whenever store items change.
  // Also triggers when store items identity changes (after delete/add).
  useEffect(() => {
    const { annotationColor, plainColor } = getColors();
    setHighlights(
      sortItemsForZOrder(storeItems)
        .filter((item) => item.kind !== "manual")
        .map((item) =>
          annotationToHighlight(item, annotationColor, plainColor),
        ),
    );
  }, [storeItems, getColors]);

  /**
   * When user finishes a text/area selection, create a new highlight:
   * 1. Convert the selection to an AnnotationItem
   * 2. Manual mode: store as pending, show selection tip
   * 3. Auto-annotate: persist + add as annotation immediately
   * 4. Auto-highlight: persist + add as plain highlight immediately
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

      const mode = usePdfViewerStore.getState().selectionMode;

      if (mode === "manual") {
        // Manual mode: store pending, show tip
        setPendingAnnotation({
          text: cleanedText,
          pageNumber,
          position: selection.position,
        });
        return;
      }

      // Auto modes: determine kind and persist
      const kind = mode === "auto-annotate" ? "annotation" : "highlight";

      const item = selectionToAnnotation(
        id,
        documentId,
        {
          ...ghost,
          content: ghost.content
            ? { ...ghost.content, text: cleanedText }
            : undefined,
        } as GhostHighlight,
        kind,
      );

      // Persist via the store — addItem triggers the useEffect above, which
      // re-sorts by z-order and re-renders the highlights array. No manual
      // setHighlights here, so ordering stays consistent with reload.
      addItem(item);
      window.getSelection()?.removeAllRanges();
    },
    [documentId, addItem, setPendingAnnotation],
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
      // Drop any deferred scroll so its poll never outlives the viewer
      // (also StrictMode-safe).
      clearQueuedScroll();
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
              const h = highlightsRef.current.find((hl) => hl.id === id);
              if (h?.kind === "highlight") {
                // Plain highlight click — show conversion tip
                window.dispatchEvent(
                  new CustomEvent("siltflow:highlight-click", {
                    detail: { id },
                  }),
                );
              } else {
                // Annotation highlight click — scroll right panel
                window.dispatchEvent(
                  new CustomEvent("siltflow:annotation-click", {
                    detail: { id },
                  }),
                );
              }
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
  const setFitWidth = usePdfViewerStore((s) => s.setFitWidth);
  const pdfScale = usePdfViewerStore((s) => s.pdfScale);
  const fitWidth = usePdfViewerStore((s) => s.fitWidth);
  const lastPage = usePdfViewerStore((s) => s.lastPageByDocId[documentId]);
  const pdfScrollbar = useStyleStore((s) => s.style.pdfScrollbar);
  const setLastPage = usePdfViewerStore((s) => s.setLastPage);
  const selectionMode = usePdfViewerStore((s) => s.selectionMode);
  const updateDoc = useDocumentStore((s) => s.updateDocument);
  const resizing = usePanelResizeState();
  // Mirror into a ref: the ResizeObserver callback and applyFitWidthScaleRef
  // are stable closures, so they must read the live value through the ref
  // instead of capturing `resizing` directly.
  const resizingRef = useRef(resizing);
  resizingRef.current = resizing;

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

    void pdfDocument.getMetadata().then((meta) => {
      const metadata = JSON.stringify(meta);
      void window.siltflow.documents.updateMetadata({
        id: documentId,
        totalPages,
        metadata,
      });
    });
  }, [pdfDocument, documentId, updateDoc]);

  // Numeric scale is used for both fit-width and manual zoom. Using a fixed
  // number (not the "page-width" preset) keeps page geometry static, so the
  // library's scrollToHighlight target stays correct while smooth-scrolling —
  // the dynamic page-width preset rescales on page change and drifts the target.
  const pdfScaleValue: PdfScaleValue | undefined =
    pdfScale > 0 ? pdfScale : undefined;

  const handleZoomChange = useCallback(
    (scale: number) => {
      // User manually zoomed (ctrl+wheel / pinch) — exit fit-width and adopt
      // the chosen numeric scale.
      setPdfScale(Math.round(scale * 100) / 100);
      setFitWidth(false);
    },
    [setPdfScale, setFitWidth],
  );

  /** Render a floating "Add annotation" tip after selection in manual mode. */
  const selectionTipContent =
    selectionMode === "manual" ? <SelectionTip /> : undefined;

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

  // ── Fit-to-width: keep a numeric scale that tracks container width ──────
  // Unlike pdf.js's "page-width" preset (which rescales on page change and
  // drifts the library's scrollToHighlight target mid-smooth-scroll), we
  // compute a fixed numeric scale from the container width and the page's
  // un-scaled PDF dimensions. The scale stays static while scrolling, so jump
  // targets remain exact. Toggling fit-width off preserves the current zoom.
  const viewerRef = useRef<ReturnType<PdfHighlighterUtils["getViewer"]>>(null);
  const fitWidthRef = useRef(fitWidth);
  fitWidthRef.current = fitWidth;
  // 首次打开的重试定时器：pdf.js 的 page view（含 rawDims）在 pagesinit 之后
  // 才初始化，而 ResizeObserver 只在容器尺寸变化时触发——mount 时若页面尚未
  // 初始化，fit-width 会被静默跳过，直到用户调整窗口才生效。拿不到页面尺寸时
  // 定时重试，直到 page view 就绪。生命周期由 fitWidthRef 与 effect cleanup
  // 管理：fit-width 关闭或组件卸载即停止。
  const fitWidthRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fitWidthRetriesRef = useRef(0);
  // Stable apply function (created once — same idiom as the store's
  // saveLayoutRef). The retry timer re-invokes it via the ref at runtime, so
  // there's no self-reference at definition time. setPdfScale is read through
  // the store to avoid a hook-derived value leaking into the closure.
  const applyFitWidthScaleRef = useRef(function applyFitWidthScale() {
    // Freeze during panel drag: skip re-layout while a sash is being dragged so
    // each pointermove tick doesn't trigger a full-resolution pdf.js re-render
    // (maxCanvasPixels is -1, so pdf.js has no CSS-zoom fast path). The
    // onDragEnd effect below re-applies once with the final width.
    if (resizingRef.current) return;
    const viewer = viewerRef.current;
    const container =
      wrapperRef.current?.querySelector<HTMLElement>(".PdfHighlighter");
    if (!viewer || !container) return;
    // rawDims.pageWidth is the page's PDF-unit width (viewBox span); convert to
    // CSS pixels (96/72). scale = container width / page CSS width, matching
    // pdf.js's own "page-width" computation exactly.
    const rawDims = viewer.getPageView(0)?.viewport?.rawDims as
      { pageWidth: number } | undefined;
    if (!rawDims?.pageWidth) {
      // page view 未初始化（pagesinit 未触发）——定时重试，不要静默放弃。
      if (!fitWidthRef.current) return;
      // 上限保护：约 8s 内页面仍未就绪则放弃（此时 PDF 大概率加载失败）。
      if (fitWidthRetriesRef.current >= 100) return;
      fitWidthRetriesRef.current += 1;
      if (fitWidthRetryRef.current) clearTimeout(fitWidthRetryRef.current);
      fitWidthRetryRef.current = setTimeout(() => {
        fitWidthRetryRef.current = null;
        applyFitWidthScaleRef.current();
      }, 80);
      return;
    }
    fitWidthRetriesRef.current = 0;
    const cssWidth = rawDims.pageWidth * (96 / 72);
    const scale = container.clientWidth / cssWidth;
    if (!Number.isFinite(scale) || scale <= 0) return;
    usePdfViewerStore.getState().setPdfScale(Math.round(scale * 1000) / 1000);
    // Apply directly; the library's handleScaleValue keeps it (0.5% tolerance).
    viewer.currentScale = Math.round(scale * 1000) / 1000;
  });

  useEffect(() => {
    if (!fitWidth) return;
    const container =
      wrapperRef.current?.querySelector<HTMLElement>(".PdfHighlighter");
    if (!container) return;
    // Compute once now (viewer may already be ready), then on every resize.
    fitWidthRetriesRef.current = 0;
    applyFitWidthScaleRef.current();
    const observer = new ResizeObserver(() => {
      // 每次尺寸变化都是新的一轮：重置重试计数（首个 observe tick 也会触发）。
      // 拖拽中冻结：resizingRef 为 true 时跳过，松手后由下方 effect 补排一次。
      if (resizingRef.current) return;
      fitWidthRetriesRef.current = 0;
      applyFitWidthScaleRef.current();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      // fit-width 关闭/卸载时停掉首次打开的 retry 定时器
      if (fitWidthRetryRef.current) {
        clearTimeout(fitWidthRetryRef.current);
        fitWidthRetryRef.current = null;
      }
    };
  }, [fitWidth]);

  // Re-apply fit-width once after a panel drag ends. During the drag the
  // ResizeObserver was frozen (resizingRef guard), so the final width never
  // produced a re-layout; this effect catches the true→false transition and
  // runs the last resize with the final container width.
  const wasResizingRef = useRef(false);
  useEffect(() => {
    if (!fitWidth) return;
    if (resizing) {
      wasResizingRef.current = true;
      return;
    }
    if (wasResizingRef.current) {
      wasResizingRef.current = false;
      if (fitWidthRef.current) applyFitWidthScaleRef.current();
    }
  }, [resizing, fitWidth]);

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
          viewerRef.current = viewer;
          if (viewer) viewer.maxCanvasPixels = -1;
          // If fit-width is active, apply the numeric scale now that the viewer
          // is ready (the mount-time ResizeObserver tick may have run too early).
          if (fitWidthRef.current) applyFitWidthScaleRef.current();

          // Expose scrollToHighlight so RightPanel can call it
          // Use a ref so the closure always sees the latest highlights array.
          registerScrollToHighlight((id: string) => {
            // The library's scrollToHighlight computes far-page targets from
            // real page geometry, so a single call suffices — defer only if the
            // highlight isn't loaded yet or the viewer isn't mounted (both
            // happen on a document switch, when annotations load async).
            scrollToHighlightWhenReady(id, utils, highlightsRef);
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
