import { useRef, useEffect, useCallback, useState } from "react"
import { BookOpen } from "lucide-react"
import { PdfViewer, type PdfViewerHandle } from "@/components/document/PdfViewer"
import { useAnnotationStore } from "@/stores/annotation.store"

interface CenterPanelProps {
  documentPath?: string | null
  documentId?: string | null
}

export function CenterPanel({ documentPath, documentId }: CenterPanelProps) {
  const pdfRef = useRef<PdfViewerHandle>(null)
  const [docReady, setDocReady] = useState(false)
  const setItems = useAnnotationStore((s) => s.setItems)
  const pendingDeletes = useAnnotationStore((s) => s.pendingDeletes)
  const clearDeletes = useAnnotationStore((s) => s.clearDeletes)

  // Live annotation events from embedPDF → save to DB immediately
  const handleAnnotationEvent = useCallback(
    async (event: {
      type: string
      annotation: { id: string; type?: string; page?: number }
    }) => {
      if (!documentId) return

      if (event.type === "create") {
        // Save annotation to DB immediately
        try {
          const items = await pdfRef.current?.saveAnnotations()
          if (items) {
            const created = items.find((i) => i.annotation.id === event.annotation.id)
            if (created) {
              await window.siltflow.annotations.save({
                id: created.annotation.id,
                documentId,
                type: created.annotation.type || event.annotation.type || "highlight",
                text: (created.annotation as any).text || "",
                pageNumber: created.annotation.page ?? event.annotation.page ?? 0,
                embedData: JSON.stringify(created),
              })
              // Refresh the store
              const saved = await window.siltflow.annotations.list(documentId)
              if (saved) setItems(saved)
            }
          }
        } catch (err) {
          console.error("Failed to save annotation:", err)
        }
      }

      if (event.type === "delete") {
        // Delete from DB
        await window.siltflow.annotations.delete(event.annotation.id)
        const saved = await window.siltflow.annotations.list(documentId)
        if (saved) setItems(saved)
      }
    },
    [documentId, setItems]
  )

  const handleDocumentReady = useCallback(() => {
    setDocReady(true)
  }, [])

  // When document is ready, restore annotations from DB
  useEffect(() => {
    if (!documentId || !docReady) return

    const restore = async () => {
      try {
        const saved = await window.siltflow.annotations.list(documentId)
        if (saved && saved.length > 0) {
          const items = saved.map((a: any) => JSON.parse(a.embedData))
          await pdfRef.current?.loadAnnotations(items)
        }
        setItems(saved || [])
      } catch (err) {
        console.error("Failed to restore annotations:", err)
      }
    }
    restore()
  }, [documentId, docReady, setItems])

  // Process pending deletes from RightPanel
  useEffect(() => {
    pendingDeletes.forEach(async (pd) => {
      try {
        // Remove from embedPDF viewer
        await pdfRef.current?.deleteAnnotation(pd.pageNumber, pd.id)
        // Delete from DB
        await window.siltflow.annotations.delete(pd.id)
        // Remove from store
        useAnnotationStore.getState().removeItem(pd.id)
      } catch {
        // silent
      }
    })
    if (pendingDeletes.length > 0) clearDeletes()
  }, [pendingDeletes, clearDeletes])

  // Reset when document changes
  useEffect(() => {
    setDocReady(false)
    if (!documentId) setItems([])
  }, [documentId, setItems])

  if (!documentPath) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-10 items-center border-b px-3">
          <h1 className="text-sm font-medium">Siltflow</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <BookOpen className="h-12 w-12" />
            <p className="text-sm">Select a document to start reading</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center border-b px-3">
        <h1 className="text-sm font-medium truncate">
          {documentPath.split("/").pop()?.split("\\").pop()}
        </h1>
      </div>
      <div className="flex-1 min-h-0">
        <PdfViewer
          ref={pdfRef}
          className="h-full w-full"
          src={documentPath}
          documentId={documentId}
          onDocumentReady={handleDocumentReady}
          onAnnotationEvent={handleAnnotationEvent}
        />
      </div>
    </div>
  )
}
