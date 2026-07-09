import { forwardRef, useRef, useImperativeHandle } from "react"
import { PDFViewer } from "@embedpdf/react-pdf-viewer"
import type { PDFViewerRef, AnnotationTransferItem } from "@embedpdf/react-pdf-viewer"
import { usePdfApiStore } from "@/stores/pdf-api.store"

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
    annotation: { id: string; type?: string; page?: number }
    pageIndex?: number
    selectedText?: string
  }) => void
}

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>((
  { src, documentId, className, onDocumentReady, onAnnotationEvent },
  ref,
) => {
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
      const thumbPlugin = registry?.getPlugin("thumbnail")
      const bmPlugin = registry?.getPlugin("bookmark")
      const dmApi = registry?.getPlugin("document-manager")?.provides?.()
      const scrollPlugin = registry?.getPlugin("scroll")

      // Get embedPDF's internal document ID
      const internalDocId = dmApi?.getActiveDocumentId?.()

      // Register scroll API for page navigation
      if (scrollPlugin?.provides) {
        const scrollApi = scrollPlugin.provides()
        const scope = internalDocId ? scrollApi.forDocument(internalDocId) : scrollApi
        usePdfApiStore.getState().setScrollApi({
          scrollToPage: (pageIndex: number) => scope.scrollToPage({ pageNumber: pageIndex + 1 }),
        })
      }

      // Register thumbnail API
      if (thumbPlugin?.provides) {
        const thumbApi = thumbPlugin.provides()
        const scope = internalDocId ? thumbApi.forDocument(internalDocId) : thumbApi
        const renderThumb = (pageIdx: number, dpr: number) =>
          new Promise<Blob | null>((resolve) => {
            scope.renderThumb(pageIdx, dpr).wait(
              (blob: Blob) => resolve(blob),
              () => resolve(null),
            )
          })
        const doc = dmApi?.getDocument?.(internalDocId) as any
        usePdfApiStore.getState().setThumbApi({
          renderThumb,
          totalPages: doc?.pageCount || 0,
        })
      }

      // Register bookmark API
      if (bmPlugin?.provides) {
        const bmApi = bmPlugin.provides()
        const scope = internalDocId ? bmApi.forDocument(internalDocId) : bmApi
          getBookmarks: async () => {
            const result = await new Promise<any[]>((resolve) => {
              bmApi.getBookmarks().wait(
                (data: any) => resolve(data?.bookmarks || []),
                () => resolve([]),
              )
            })
            return result
          },
        })
      }

      // Capture text whenever selection changes
      function captureText() {
        selApi?.getSelectedText()?.wait?.(
          (texts: string[]) => { if (texts?.length) pendingTextRef.current = texts.join("") },
          () => {},
        )
      }
      if (selApi?.onSelectionChange) selApi.onSelectionChange(captureText)
      if (selApi?.onEndSelection) selApi.onEndSelection(captureText)

      // Subscribe to annotation events
      if (onAnnotationEvent && annApi?.onAnnotationEvent) {
        annApi.onAnnotationEvent((event: any) => {
          if (event.type === "loaded") return

          if (event.type === "create") {
            const selText = pendingTextRef.current
            pendingTextRef.current = ""

            onAnnotationEvent({
              type: "create",
              annotation: { id: event.annotation?.id, type: event.annotation?.type, page: event.pageIndex },
              pageIndex: event.pageIndex,
              selectedText: selText || undefined,
            })

            if (!selText) {
              selApi?.getSelectedText()?.wait?.(
                (texts: string[]) => {
                  const text = texts?.join("") || ""
                  if (text) {
                    onAnnotationEvent({
                      type: "create",
                      annotation: { id: event.annotation?.id, type: event.annotation?.type, page: event.pageIndex },
                      pageIndex: event.pageIndex,
                      selectedText: text,
                    })
                  }
                },
                () => {},
              )
            }
          } else if (event.type === "delete") {
            onAnnotationEvent({
              type: "delete",
              annotation: { id: event.annotation?.id },
            })
          }
        })
      }

      setTimeout(() => onDocumentReady?.(), 300)
    }

    return (
      <div className={className}>
        <PDFViewer
          ref={viewerRef}
          config={{
            src,
            annotations: { deactivateToolAfterCreate: true },
          }}
          style={{ width: "100%", height: "100%" }}
          onReady={handleReady}
        />
      </div>
    )
  }
)
