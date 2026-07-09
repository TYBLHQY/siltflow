import { useCallback, useRef, useState, useEffect } from "react"
import { PdfLoader, PdfHighlighter, Highlight } from "react-pdf-highlighter"
import type { IHighlight, NewHighlight, ScaledPosition, Content } from "react-pdf-highlighter"
import { Trash2 } from "lucide-react"
import { useAnnotationStore, type AnnotationItem } from "@/stores/annotation.store"

const PDF_WORKER_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`

interface PdfViewerProps {
  src: string
  documentId: string
  className?: string
}

export function PdfViewer({ src, documentId, className }: PdfViewerProps) {
  const scrollViewerTo = useRef<(highlight: IHighlight) => void>(() => {})
  const { items: storeItems, setItems, addItem, removeItem, queueDelete } = useAnnotationStore()
  const [renderKey, setRenderKey] = useState(0)

  // Convert store items → IHighlight[] for PdfHighlighter
  const [highlights, setHighlights] = useState<IHighlight[]>(() =>
    storeItems.map(toHighlight),
  )

  useEffect(() => {
    setHighlights(storeItems.map(toHighlight))
    // Force re-render on highlight changes
    setRenderKey((k) => k + 1)
  }, [storeItems])

  // New highlight created from text selection
  const handleSelectionFinished = useCallback(
    (
      position: ScaledPosition,
      content: Content,
      hideTipAndSelection: () => void,
    ) => {
      return (
        <button
          className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded shadow hover:bg-primary/90 transition-colors whitespace-nowrap"
          onClick={async () => {
            const text = content.text || ""
            const id = crypto.randomUUID()
            const item: AnnotationItem = {
              id,
              documentId,
              type: "Highlight",
              text,
              pageNumber: position.pageNumber || 0,
              embedData: { content, position },
            }

            // Save to DB
            await window.siltflow.annotations.save({
              id,
              documentId,
              type: "Highlight",
              text,
              pageNumber: position.pageNumber || 0,
              embedData: JSON.stringify(item.embedData),
            })

            addItem(item)
            hideTipAndSelection()
          }}
          type="button"
        >
          Highlight
        </button>
      )
    },
    [documentId, addItem],
  )

  // Delete highlight
  const handleDelete = useCallback(
    async (id: string) => {
      queueDelete(id, 0)
    },
    [queueDelete],
  )

  return (
    <div className={className}>
      <PdfLoader
        url={src}
        workerSrc={PDF_WORKER_SRC}
        beforeLoad={
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Loading PDF...
          </div>
        }
        errorMessage={
          <div className="flex items-center justify-center h-full text-destructive text-sm">
            Failed to load PDF
          </div>
        }
      >
        {(pdfDocument) => (
          <PdfHighlighter
            pdfDocument={pdfDocument}
            highlights={highlights}
            key={documentId}
            onSelectionFinished={handleSelectionFinished}
            highlightTransform={(
              highlight,
              _index,
              _setTip,
              _hideTip,
              _viewportToScaled,
              _screenshot,
              _isScrolledTo,
            ) => (
              <Highlight
                key={_index}
                position={highlight.position}
                comment={highlight.comment || { text: "", emoji: "" }}
                isScrolledTo={_isScrolledTo}
                onMouseOver={() =>
                  _setTip(highlight, () => (
                    <button
                      className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded shadow hover:opacity-90"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(highlight.id)
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  ))
                }
                onMouseOut={_hideTip}
              />
            )}
            scrollRef={(scrollTo) => {
              scrollViewerTo.current = scrollTo
            }}
            onScrollChange={() => {}}
          />
        )}
      </PdfLoader>
    </div>
  )
}

function toHighlight(item: AnnotationItem): IHighlight {
  const data = item.embedData as any
  return {
    id: item.id,
    content: { text: item.text },
    position: data.position || data,
    comment: { text: "", emoji: "" },
  }
}
