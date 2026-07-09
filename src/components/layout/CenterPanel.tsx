import { useRef, useEffect, useCallback } from "react"
import { BookOpen } from "lucide-react"
import { PdfViewer } from "@/components/document/PdfViewer"
import { useAnnotationStore } from "@/stores/annotation.store"

interface CenterPanelProps {
  documentPath?: string | null
  documentId?: string | null
}

export function CenterPanel({ documentPath, documentId }: CenterPanelProps) {
  const setItems = useAnnotationStore((s) => s.setItems)
  const pendingDeletes = useAnnotationStore((s) => s.pendingDeletes)
  const clearDeletes = useAnnotationStore((s) => s.clearDeletes)
  const loadedDocRef = useRef<string | null>(null)

  // Load annotations from DB when document changes
  useEffect(() => {
    if (!documentId) {
      setItems([])
      loadedDocRef.current = null
      return
    }
    loadedDocRef.current = documentId
    window.siltflow.annotations.list(documentId).then((saved) => {
      if (loadedDocRef.current !== documentId) return // stale
      setItems(
        (saved || []).map((a: any) => ({
          id: a.id,
          documentId: a.documentId,
          type: a.type,
          text: a.text || "",
          pageNumber: a.pageNumber || 0,
          embedData: JSON.parse(a.embedData),
        })),
      )
    })
  }, [documentId, setItems])

  // Process pending deletes (from right panel)
  useEffect(() => {
    pendingDeletes.forEach(async (pd) => {
      await window.siltflow.annotations.delete(pd.id)
    })
    if (pendingDeletes.length > 0) clearDeletes()
  }, [pendingDeletes, clearDeletes])

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
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <div className="absolute inset-0">
          <PdfViewer
            className="h-full w-full"
            src={documentPath}
            documentId={documentId}
          />
        </div>
      </div>
    </div>
  )
}
