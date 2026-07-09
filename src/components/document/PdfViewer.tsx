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
  }) => void
}

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(
  function PdfViewer({ src, documentId, className, onDocumentReady, onAnnotationEvent }, ref) {
    const viewerRef = useRef<PDFViewerRef>(null)
    const onReadyCalledRef = useRef(false)

    useImperativeHandle(ref, () => ({
      saveAnnotations: async () => {
        try {
          const registry = await viewerRef.current?.registry
          if (!registry) return []
          const annPlugin = registry.getPlugin<any>("annotation")
          if (!annPlugin?.provides) return []
          const api = annPlugin.provides()
          const items = await new Promise<AnnotationTransferItem[]>((resolve) => {
            api.exportAnnotations()?.wait?.(
              (items: AnnotationTransferItem[]) => resolve(items || []),
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
          const registry = await viewerRef.current?.registry
          if (!registry || items.length === 0) return
          const annPlugin = registry.getPlugin<any>("annotation")
          if (!annPlugin?.provides) return
          const api = annPlugin.provides()
          api.importAnnotations(items)
        } catch {
          // silent
        }
      },
      deleteAnnotation: async (pageIndex: number, annotationId: string) => {
        try {
          const registry = await viewerRef.current?.registry
          if (!registry) return
          const annPlugin = registry.getPlugin<any>("annotation")
          if (!annPlugin?.provides) return
          const api = annPlugin.provides()
          api.deleteAnnotation(pageIndex, annotationId)
        } catch {
          // silent
        }
      },
    }))

    // Subscribe to annotation events once the registry is ready
    const handleReady = (registry: any) => {
      if (onReadyCalledRef.current) return
      onReadyCalledRef.current = true

      const annPlugin = registry.getPlugin<any>("annotation")
      if (annPlugin?.provides) {
        const api = annPlugin.provides()

        // Subscribe to live annotation events → push to parent
        if (onAnnotationEvent && api.onAnnotationEvent?.on) {
          api.onAnnotationEvent.on((event: any) => {
            onAnnotationEvent({
              type: event.type,
              annotation: {
                id: event.annotation?.id,
                type: event.annotation?.type,
                page: event.pageIndex,
                text: event.annotation?.text,
              },
              pageIndex: event.pageIndex,
            })
          })
        }
      }

      // Notify parent that document is ready for operation
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
