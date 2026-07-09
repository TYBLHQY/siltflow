import { useCallback, useState, useEffect } from "react"
import { PdfLoader, PdfHighlighter, Highlight } from "react-pdf-highlighter"
import type { IHighlight, ScaledPosition, Content } from "react-pdf-highlighter"
import { useAnnotationStore, type AnnotationItem } from "@/stores/annotation.store"

const PDF_WORKER_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`

interface PdfViewerProps {
  src: string
  documentId: string
  className?: string
}

export function PdfViewer({ src, documentId, className }: PdfViewerProps) {
  const { items: storeItems, addItem } = useAnnotationStore()

  const [highlights, setHighlights] = useState<IHighlight[]>(() =>
    storeItems.map(toHighlight),
  )

  useEffect(() => {
    setHighlights(storeItems.map(toHighlight))
  }, [storeItems])

  const handleSelectionFinished = useCallback(
    (
      position: ScaledPosition,
      content: Content,
      hideTipAndSelection: () => void,
    ) => {
      return (
        <button
          className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded shadow hover:bg-primary/90 whitespace-nowrap"
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
              />
            )}
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
