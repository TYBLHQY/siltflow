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
}

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(
  function PdfViewer({ src, documentId, className }, ref) {
    const viewerRef = useRef<PDFViewerRef>(null)

    useImperativeHandle(ref, () => ({
      saveAnnotations: async () => {
        try {
          const registry = await viewerRef.current?.registry
          if (!registry) return []
          const annPlugin = registry.getPlugin<any>("annotation")
          if (!annPlugin?.provides) return []
          const api = annPlugin.provides()
          const items = await new Promise<AnnotationTransferItem[]>((resolve, reject) => {
            api.exportAnnotations()?.wait?.(resolve, reject) ?? resolve([])
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

    return (
      <div className={className}>
        <PDFViewer
          ref={viewerRef}
          config={{
            src,
          }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    )
  }
)
