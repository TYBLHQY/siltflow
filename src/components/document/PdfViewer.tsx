import { useCallback, useState, useEffect, useRef } from "react"
import {
  PdfLoader,
  PdfHighlighter,
  TextHighlight,
  AreaHighlight,
  FreetextHighlight,
  DrawingHighlight,
  ImageHighlight,
  ShapeHighlight,
  useHighlightContainerContext,
} from "react-pdf-highlighter-plus"
import type {
  Highlight as RPHLHighlight,
  PdfSelection,
  GhostHighlight,
  LTWHP,
  PdfHighlighterUtils,
  PdfScaleValue,
} from "react-pdf-highlighter-plus"
import { useAnnotationStore, type AnnotationItem } from "@/stores/annotation.store"
import { usePdfViewerStore } from "@/stores/pdf-viewer.store"
import type { PDFDocumentProxy } from "pdfjs-dist"

// ---------------------------------------------------------------------------
// SiltflowHighlight — our application-specific highlight extension
// ---------------------------------------------------------------------------
export interface SiltflowHighlight extends RPHLHighlight {
  /** User-facing comment string. */
  comment?: string
  /** Text-highlight background color. */
  highlightColor?: string
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
  const embed = item.embedData as AnnotationItem["embedData"]
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
  }
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
  const pageNumber = ghost.position.boundingRect.pageNumber ?? 1
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
  }
}

// ---------------------------------------------------------------------------
// SiltflowHighlightContainer
// ---------------------------------------------------------------------------

interface SiltflowHighlightContainerProps {
  deleteHighlight(id: string): void
}

/**
 * Renders whichever highlight component matches `highlight.type`.
 * This is what gets passed as a child to `<PdfHighlighter>`.
 */
function SiltflowHighlightContainer({
  deleteHighlight,
}: SiltflowHighlightContainerProps) {
  const {
    highlight,
    isScrolledTo,
    highlightBindings,
  } = useHighlightContainerContext<SiltflowHighlight>()
  const setScrolledHighlightId = usePdfViewerStore((s) => s.setScrolledHighlightId)

  // Sync the library's scroll state → store so RightPanel cards light up
  useEffect(() => {
    if (isScrolledTo) {
      setScrolledHighlightId(highlight.id)
    }
  }, [isScrolledTo, highlight.id, setScrolledHighlightId])

  const handleDelete = useCallback(
    () => deleteHighlight(highlight.id),
    [deleteHighlight, highlight.id],
  )

  switch (highlight.type) {
    case "text":
      return (
        <TextHighlight
          key={highlight.id}
          isScrolledTo={isScrolledTo}
          highlight={highlight}
          highlightColor={highlight.highlightColor}
          onDelete={handleDelete}
          copyText={highlight.content?.text}
        />
      )

    case "freetext":
      return (
        <FreetextHighlight
          key={highlight.id}
          isScrolledTo={isScrolledTo}
          highlight={highlight}
          bounds={highlightBindings.textLayer}
          onDelete={handleDelete}
        />
      )

    case "image":
      return (
        <ImageHighlight
          key={highlight.id}
          isScrolledTo={isScrolledTo}
          highlight={highlight}
          bounds={highlightBindings.textLayer}
          onDelete={handleDelete}
        />
      )

    case "drawing":
      return (
        <DrawingHighlight
          key={highlight.id}
          isScrolledTo={isScrolledTo}
          highlight={highlight}
          bounds={highlightBindings.textLayer}
          onDelete={handleDelete}
        />
      )

    case "shape":
      return (
        <ShapeHighlight
          key={highlight.id}
          isScrolledTo={isScrolledTo}
          highlight={highlight}
          bounds={highlightBindings.textLayer}
          onDelete={handleDelete}
        />
      )

    default:
      // Area highlight — default fallback
      return (
        <AreaHighlight
          key={highlight.id}
          isScrolledTo={isScrolledTo}
          highlight={highlight}
          highlightColor={highlight.highlightColor}
          onChange={(_rect: LTWHP) => {
            /* update position on resize — optional */
          }}
          bounds={highlightBindings.textLayer}
          onDelete={handleDelete}
        />
      )
  }
}

// ---------------------------------------------------------------------------
// PdfViewer component
// ---------------------------------------------------------------------------

interface PdfViewerProps {
  src: string
  documentId: string
  className?: string
}

export function PdfViewer({ src, documentId, className }: PdfViewerProps) {
  const storeItems = useAnnotationStore((s) => s.items)
  const addItem = useAnnotationStore((s) => s.addItem)
  const removeItem = useAnnotationStore((s) => s.removeItem)
  const [highlights, setHighlights] = useState<SiltflowHighlight[]>(() =>
    storeItems.map(annotationToHighlight),
  )
  // Ref always pointing to the current highlights array, so callbacks captured
  // in utilsRef can find the latest highlights even after new ones are added.
  const highlightsRef = useRef(highlights)
  highlightsRef.current = highlights

  // Sync from store -> component state whenever store items change.
  // Also triggers when store items identity changes (after delete/add).
  useEffect(() => {
    setHighlights(storeItems.map(annotationToHighlight))
  }, [storeItems])

  /**
   * When user finishes a text/area selection, create a new highlight:
   * 1. Convert the selection to an AnnotationItem and persist to backend
   * 2. Update the local highlights state immediately (before store reacts)
   * 3. Add to Zustand store for RightPanel/LeftPanel to pick up
   *
   * We do NOT call selection.makeGhostHighlight() because that creates a
   * temporary ghost overlay that blocks interaction with the permanent
   * highlight underneath. Instead we update the highlights array directly
   * and let the library's useEffect + renderHighlightLayers pick it up.
   */
  const handleSelection = useCallback(
    (selection: PdfSelection) => {
      const id = crypto.randomUUID()
      // Build the ghost object WITHOUT calling makeGhostHighlight (which
      // would modify library internal state and block the permanent highlight).
      const ghost: GhostHighlight = {
        type: "text",
        content: selection.content,
        position: selection.position,
      }
      const cleanedText = (ghost.content?.text ?? "").replace(/\n/g, " ")
      const item = selectionToAnnotation(id, documentId, {
        ...ghost,
        content: ghost.content ? { ...ghost.content, text: cleanedText } : undefined,
      } as GhostHighlight)

      // Persist to Electron backend (embedData as JSON string)
      window.siltflow.annotations.save({
        id,
        documentId,
        type: ghost.type || "highlight",
        text: cleanedText,
        pageNumber: ghost.position.boundingRect.pageNumber ?? 1,
        embedData: JSON.stringify(item.embedData),
      })

      // Update highlights immediately so the library renders the new
      // highlight without needing a second render cycle.
      setHighlights((prev) => [...prev, annotationToHighlight(item)])
      // Add to Zustand store for sidebar panels
      addItem(item)

      // Clear the text selection so the user doesn't see blue highlights
      // lingering on the selected text.
      window.getSelection()?.removeAllRanges()
    },
    [documentId, addItem],
  )

  /**
   * Delete a highlight:
   * 1. Delete from Electron backend (IPC)
   * 2. Remove from Zustand store
   */
  const deleteHighlight = useCallback(
    (id: string) => {
      window.siltflow.annotations.delete(id)
      removeItem(id)
    },
    [removeItem],
  )

  // Clean up store state when documentId changes
  // NOTE: only clean pdfDocument and scroll helpers, NOT goToPage — the
  // library's utilsRef only fires ONCE (guarded by an internal ref), so
  // cleaning it in StrictMode's unmount/remount cycle would leave it null forever.
  const pdfDocumentCleanup = usePdfViewerStore((s) => s.setPdfDocument)
  const setScrollToHighlightCleanup = usePdfViewerStore((s) => s.setScrollToHighlight)
  const setScrolledHighlightIdCleanup = usePdfViewerStore((s) => s.setScrolledHighlightId)
  useEffect(() => {
    return () => {
      pdfDocumentCleanup(null)
      setScrollToHighlightCleanup(null)
      setScrolledHighlightIdCleanup(null)
    }
  }, [documentId, pdfDocumentCleanup, setScrollToHighlightCleanup, setScrolledHighlightIdCleanup])

  return (
    <div className={className}>
      <PdfLoader
        document={src}
        beforeLoad={() => (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Loading PDF...
          </div>
        )}
        errorMessage={() => (
          <div className="flex items-center justify-center h-full text-destructive text-sm">
            Failed to load PDF
          </div>
        )}
      >
        {(pdfDocument) => (
          <PdfHighlighterWrapper
            pdfDocument={pdfDocument}
            documentId={documentId}
            highlights={highlights}
            onSelection={handleSelection}
            deleteHighlight={deleteHighlight}
          />
        )}
      </PdfLoader>
    </div>
  )
}

/** Wraps PdfHighlighter, syncing PDF state to the shared store. */
function PdfHighlighterWrapper({
  pdfDocument,
  documentId,
  highlights,
  onSelection,
  deleteHighlight,
}: {
  pdfDocument: PDFDocumentProxy
  documentId: string
  highlights: SiltflowHighlight[]
  onSelection: (selection: PdfSelection) => void
  deleteHighlight: (id: string) => void
}) {
  const setPdfDocument = usePdfViewerStore((s) => s.setPdfDocument)
  const setGoToPage = usePdfViewerStore((s) => s.setGoToPage)
  const setCurrentPage = usePdfViewerStore((s) => s.setCurrentPage)
  const setPdfScale = usePdfViewerStore((s) => s.setPdfScale)
  const setSetViewerScale = usePdfViewerStore((s) => s.setSetViewerScale)
  const pdfScale = usePdfViewerStore((s) => s.pdfScale)
  const fitWidth = usePdfViewerStore((s) => s.fitWidth)
  const setScrolledHighlightId = usePdfViewerStore((s) => s.setScrolledHighlightId)
  const setScrollToHighlightStore = usePdfViewerStore((s) => s.setScrollToHighlight)

  // Sync pdfDocument to store via effect
  useEffect(() => {
    setPdfDocument(pdfDocument)
  }, [pdfDocument, setPdfDocument])

  // Example pattern: pdfScaleValue is always numeric (or undefined = auto).
  // 0 means "not yet set" → omit prop so library defaults to "auto".
  // After any zoom, pdfScale holds a real number and gets passed as prop;
  // the library's proximity check (< 0.5% diff) skips re-apply on re-renders.
  //
  // When fitWidth is active, pass "page-width" so the built-in ResizeObserver
  // keeps applying it (otherwise undefined → "auto" overrides).
  const numScale = pdfScale > 0 ? pdfScale : undefined
  const pdfScaleValue: PdfScaleValue | undefined = fitWidth ? "page-width" : numScale

  const handleZoomChange = useCallback(
    (scale: number) => {
      // Fit-to-width mode: don't interfere — the page-width value handles
      // container resize automatically.
      if (fitWidth) return
      // User manually zoomed (ctrl+wheel etc.) — store the numeric value
      setPdfScale(Math.round(scale * 100) / 100)
    },
    [fitWidth, setPdfScale],
  )

  return (
    <PdfHighlighter
      pdfDocument={pdfDocument}
      highlights={highlights}
      key={documentId}
      onSelection={onSelection}
      onScrollAway={() => setScrolledHighlightId(null)}
      utilsRef={(utils: PdfHighlighterUtils) => {
        setGoToPage((pageNumber: number) => utils.goToPage(pageNumber))

        // Unlock canvas resolution cap so page-width and zoomed views
        // render at full device resolution instead of CSS-only zoom.
        const viewer = utils.getViewer()
        if (viewer) viewer.maxCanvasPixels = -1

        // Capture a raw scale setter so FitWidthButton/Settings can call
        // viewer.currentScaleValue = "page-width" directly.
        setSetViewerScale((value: string) => {
          if (viewer) viewer.currentScaleValue = value
        })

        // Expose scrollToHighlight so RightPanel/LeftPanel can call it
        // Use a ref so the closure always sees the latest highlights array.
        setScrollToHighlightStore((id: string) => {
          setScrolledHighlightId(id)
          const highlight = highlightsRef.current.find((h) => h.id === id)
          if (highlight) {
            utils.scrollToHighlight(highlight)
          }
        })
      }}
      onPageChange={(page: number) => setCurrentPage(page)}
      onZoomChange={handleZoomChange}
      pdfScaleValue={pdfScaleValue}
      style={{ height: "100%" }}
    >
      <SiltflowHighlightContainer deleteHighlight={deleteHighlight} />
    </PdfHighlighter>
  )
}
