import { forwardRef, useRef, useImperativeHandle } from "react"
import { PDFViewer } from "@embedpdf/react-pdf-viewer"
import type { PDFViewerRef, AnnotationTransferItem } from "@embedpdf/react-pdf-viewer"

export interface PdfViewerHandle {
  saveAnnotations: () => Promise<AnnotationTransferItem[]>
  loadAnnotations: (items: AnnotationTransferItem[]) => Promise<void>
  deleteAnnotation: (pageIndex: number, annotationId: string) => Promise<void>
}

interface PdfViewerProps {
  src: string
  documentId: string
  className?: string
  onDocumentReady?: () => void
  onAnnotationEvent?: (event: {
    type: string
    annotation: { id: string; type?: string; page?: number; text?: string }
    pageIndex?: number
    selectedText?: string
  }) => void
}

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(
  function PdfViewer({ src, documentId, className, onDocumentReady, onAnnotationEvent }, ref) {
    const viewerRef = useRef<PDFViewerRef>(null)
    const readyFiredRef = useRef(false)
    const pendingTextRef = useRef("")

    useImperativeHandle(ref, () => ({
      saveAnnotations: async () => {
        try {
          const reg = await viewerRef.current?.registry
          if (!reg) return []
          const api = (reg as any).getPlugin("annotation")?.provides?.()
          if (!api) return []
          const items = await new Promise<AnnotationTransferItem[]>((resolve) => {
            api.exportAnnotations().wait(
              (items: AnnotationTransferItem[]) => resolve(items ?? []),
              () => resolve([]),
            )
          })
          return items
        } catch {
          return []
        }
      },
      loadAnnotations: async (items: AnnotationTransferItem[]) => {
        try {
          const reg = await viewerRef.current?.registry
          if (!reg || !items.length) return
          const api = (reg as any).getPlugin("annotation")?.provides?.()
          api?.importAnnotations(items)
        } catch {
          // silent
        }
      },
      deleteAnnotation: async (_pageIndex: number, annotationId: string) => {
        try {
          const reg = await viewerRef.current?.registry
          if (!reg) return
          const api = (reg as any).getPlugin("annotation")?.provides?.()
          api?.deleteAnnotation?.(_pageIndex, annotationId)
        } catch {
          // silent
        }
      },
    }))

    const handleReady = (registry: any) => {
      if (readyFiredRef.current) return
      readyFiredRef.current = true

      const selApi = registry?.getPlugin("selection")?.provides?.()
      const annApi = registry?.getPlugin("annotation")?.provides?.()

      // Capture selected text on ANY selection change.
      // This covers both select-then-highlight and direct-drag modes.
      if (selApi?.onSelectionChange) {
        selApi.onSelectionChange(() => {
          selApi.getSelectedText()?.wait?.(
            (texts: string[]) => {
              if (texts?.length) {
                pendingTextRef.current = texts.join("")
              }
            },
            () => {},
          )
        })
      }
      // Fallback: also listen for end-of-selection
      if (selApi?.onEndSelection) {
        selApi.onEndSelection(() => {
          selApi.getSelectedText()?.wait?.(
            (texts: string[]) => {
              if (texts?.length) {
                pendingTextRef.current = texts.join("")
              }
            },
            () => {},
          )
        })
      }

      if (onAnnotationEvent && annApi?.onAnnotationEvent) {
        annApi.onAnnotationEvent((event: any) => {
          if (event.type === "loaded") return

          let selText = ""
          if (event.type === "create") {
            selText = pendingTextRef.current
            pendingTextRef.current = ""
          }

          onAnnotationEvent({
            type: event.type,
            annotation: {
              id: event.annotation?.id,
              type: event.annotation?.type,
              page: event.pageIndex,
            },
            pageIndex: event.pageIndex,
            selectedText: selText || undefined,
          })
        })
      }

      setTimeout(() => onDocumentReady?.(), 300)
    }

    return (
      <div className={className}>
        <PDFViewer
          ref={viewerRef}
          config={{ src }}
          style={{ width: "100%", height: "100%" }}
          onReady={handleReady}
        />
      </div>
    )
  }
)
