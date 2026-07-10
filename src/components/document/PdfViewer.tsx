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
import { useDocumentStore } from "@/stores/document.store"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { Plus } from "lucide-react"

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

/**
 * Floating "Add annotation" button that appears after text selection in manual mode.
 * Rendered via the library's selectionTip prop.
 */
function SelectionTip() {
  const setPendingAnnotation = usePdfViewerStore((s) => s.setPendingAnnotation)
  const pendingAnnotation = usePdfViewerStore((s) => s.pendingAnnotation)
  const addItem = useAnnotationStore((s) => s.addItem)

  const handleAdd = useCallback(() => {
    if (!pendingAnnotation) return
    const docId = useDocumentStore.getState().currentDocument?.id
    if (!docId) return
    const id = crypto.randomUUID()
    const item: AnnotationItem = {
      id,
      documentId: docId,
      type: "highlight",
      text: pendingAnnotation.text,
      pageNumber: pendingAnnotation.pageNumber,
      embedData: { position: pendingAnnotation.position, content: { text: pendingAnnotation.text } },
    }
    window.siltflow.annotations.save({
      id,
      documentId: docId,
      type: "highlight",
      text: pendingAnnotation.text,
      pageNumber: pendingAnnotation.pageNumber,
      embedData: JSON.stringify(item.embedData),
    })
    addItem(item)
    setPendingAnnotation(null)
    // Clear text selection so the blue highlight disappears
    window.getSelection()?.removeAllRanges()
  }, [pendingAnnotation, addItem, setPendingAnnotation])

  if (!pendingAnnotation) return null

  return (
    <div className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 shadow-lg">
      <button
        className="flex items-center gap-1 text-[11px] font-medium text-primary-foreground hover:opacity-80 transition-opacity"
        onClick={handleAdd}
      >
        <Plus className="h-3 w-3" />
        Add
      </button>
    </div>
  )
}

export function PdfViewer({ src, documentId, className }: PdfViewerProps) {
  const storeItems = useAnnotationStore((s) => s.items)
  const addItem = useAnnotationStore((s) => s.addItem)
  const removeItem = useAnnotationStore((s) => s.removeItem)
  const quickAddEnabled = usePdfViewerStore((s) => s.quickAddEnabled)
  const setPendingAnnotation = usePdfViewerStore((s) => s.setPendingAnnotation)
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
      const id = crypto.randomUUID()
      // Build the ghost object WITHOUT calling makeGhostHighlight (which
      // would modify library internal state and block the permanent highlight).
      const ghost: GhostHighlight = {
        type: "text",
        content: selection.content,
        position: selection.position,
      }
      const cleanedText = (ghost.content?.text ?? "").replace(/\n/g, " ")
      const pageNumber = ghost.position.boundingRect.pageNumber ?? 1
      const item = selectionToAnnotation(id, documentId, {
        ...ghost,
        content: ghost.content ? { ...ghost.content, text: cleanedText } : undefined,
      } as GhostHighlight)

      if (quickAddEnabled) {
        // Quick-add: persist immediately
        window.siltflow.annotations.save({
          id,
          documentId,
          type: ghost.type || "highlight",
          text: cleanedText,
          pageNumber,
          embedData: JSON.stringify(item.embedData),
        })
        setHighlights((prev) => [...prev, annotationToHighlight(item)])
        addItem(item)
        window.getSelection()?.removeAllRanges()
      } else {
        // Manual mode: store pending, show tip
        setPendingAnnotation({
          text: cleanedText,
          pageNumber,
          position: item.embedData.position,
        })
      }
    },
    [documentId, quickAddEnabled, addItem, setPendingAnnotation],
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
  useEffect(() => {
    return () => {
      pdfDocumentCleanup(null)
      setScrollToHighlightCleanup(null)
    }
  }, [documentId, pdfDocumentCleanup, setScrollToHighlightCleanup])

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
            highlightsRef={highlightsRef}
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
  highlightsRef,
  onSelection,
  deleteHighlight,
}: {
  pdfDocument: PDFDocumentProxy
  documentId: string
  highlights: SiltflowHighlight[]
  highlightsRef: React.MutableRefObject<SiltflowHighlight[]>
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
  const setScrollToHighlightStore = usePdfViewerStore((s) => s.setScrollToHighlight)
  const lastPage = usePdfViewerStore((s) => s.lastPageByDocId[documentId])
  const setLastPage = usePdfViewerStore((s) => s.setLastPage)
  const quickAddEnabled = usePdfViewerStore((s) => s.quickAddEnabled)

  // Sync pdfDocument to store via effect
  useEffect(() => {
    setPdfDocument(pdfDocument)
  }, [pdfDocument, setPdfDocument])

  // Example pattern: pdfScaleValue is always numeric (or undefined = auto).

  // When fitWidth is active, pass "page-width" so the built-in ResizeObserver
  // keeps applying it (otherwise undefined → "auto" overrides).
  const numScale = pdfScale > 0 ? pdfScale : undefined
  const pdfScaleValue: PdfScaleValue | undefined = fitWidth ? "page-width" : numScale

  const handleZoomChange = useCallback(
    (scale: number) => {
      if (fitWidth) return
      setPdfScale(Math.round(scale * 100) / 100)
    },
    [fitWidth, setPdfScale],
  )

  /** Render a floating "Add annotation" tip after selection in non-quick-add mode. */
  const selectionTipContent = !quickAddEnabled ? <SelectionTip /> : undefined

  return (
    <PdfHighlighter
      pdfDocument={pdfDocument}
      highlights={highlights}
      key={documentId}
      onSelection={onSelection}
      selectionTip={selectionTipContent}
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

        // Expose scrollToHighlight so RightPanel can call it
        // Use a ref so the closure always sees the latest highlights array.
        setScrollToHighlightStore((id: string) => {
          // Build a minimal Highlight object from the id since scrollToHighlight
          // needs the full position data. Find in the ref that stays current.
          const h = highlightsRef.current.find((h) => h.id === id)
          if (h) {
            utils.scrollToHighlight(h)
          }
        })
      }}
      onPageChange={(page: number) => {
        setCurrentPage(page)
        setLastPage(documentId, page)
      }}
      onZoomChange={handleZoomChange}
      pdfScaleValue={pdfScaleValue}
      initialPage={lastPage && lastPage > 1 ? lastPage : undefined}
      style={{ height: "100%" }}
    >
      <SiltflowHighlightContainer deleteHighlight={deleteHighlight} />
    </PdfHighlighter>
  )
}
