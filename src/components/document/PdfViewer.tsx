import { useCallback, useState, useEffect } from "react"
import { PdfLoader, PdfHighlighter, TextHighlight } from "react-pdf-highlighter-plus"
import type { Highlight, Tip, PdfSelection, ScaledPosition, Content } from "react-pdf-highlighter-plus"
import { useAnnotationStore, type AnnotationItem } from "@/stores/annotation.store"

const PDFJS_VERSION = "4.10.38"
const PDF_WORKER_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`

interface PdfViewerProps {
  src: string
  documentId: string
  className?: string
}

export function PdfViewer({ src, documentId, className }: PdfViewerProps) {
  const { items: storeItems, addItem, queueDelete } = useAnnotationStore()

  const [highlights, setHighlights] = useState<Highlight[]>(() =>
    storeItems.map(toHighlight),
  )

  useEffect(() => {
    setHighlights(storeItems.map(toHighlight))
  }, [storeItems])

  const handleSelection = useCallback(
    (selection: PdfSelection) => {
      const text = selection.content?.text
      if (!text) return

      const id = crypto.randomUUID()
      const position = selection.position

      const item: AnnotationItem = {
        id,
        documentId,
        type: "Highlight",
        text,
        pageNumber: position.pageNumber || 0,
        embedData: { content: selection.content, position },
      }

      window.siltflow.annotations.save({
        id,
        documentId,
        type: "Highlight",
        text,
        pageNumber: position.pageNumber || 0,
        embedData: JSON.stringify(item.embedData),
      })
      addItem(item)
    },
    [documentId, addItem],
  )

  const handleDelete = useCallback(
    async (highlightId: string) => {
      await window.siltflow.annotations.delete(highlightId)
      queueDelete(highlightId, 0)
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
            onSelection={handleSelection}
            onDelete={() => {}}
          />
        )}
      </PdfLoader>
    </div>
  )
}

function toHighlight(item: AnnotationItem): Highlight {
  const data = item.embedData as any
  return {
    id: item.id,
    type: "text",
    content: { text: item.text },
    position: data.position || data,
    comment: { text: "", emoji: "" },
  }
}
