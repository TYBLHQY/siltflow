import { useRef, useEffect, useCallback } from "react"
import { BookOpen } from "lucide-react"
import { PdfViewer, type PdfViewerHandle } from "@/components/document/PdfViewer"

interface CenterPanelProps {
  documentPath?: string | null
  documentId?: string | null
}

export function CenterPanel({ documentPath, documentId }: CenterPanelProps) {
  const pdfRef = useRef<PdfViewerHandle>(null)
  const prevDocRef = useRef<string | null>(null)

  const saveCurrentAnnotations = useCallback(async () => {
    if (!prevDocRef.current) return
    try {
      const items = await pdfRef.current?.saveAnnotations()
      if (items && items.length > 0) {
        // Save to DB
        for (const item of items) {
          await window.siltflow.annotations.save({
            id: item.annotation.id,
            documentId: prevDocRef.current,
            type: item.annotation.type || "highlight",
            text: "",
            pageNumber: 0,
            embedData: JSON.stringify(item),
          })
        }
      }
    } catch (err) {
      console.error("Failed to save annotations:", err)
    }
  }, [])

  const loadAnnotations = useCallback(async () => {
    if (!documentId) return
    try {
      const saved = await window.siltflow.annotations.list(documentId)
      if (saved && saved.length > 0) {
        const items = saved.map((a: any) => JSON.parse(a.embedData))
        await pdfRef.current?.loadAnnotations(items)
      }
    } catch (err) {
      console.error("Failed to load annotations:", err)
    }
  }, [documentId])

  // Handle document switching
  useEffect(() => {
    if (documentId && documentId !== prevDocRef.current) {
      // Save previous document's annotations first
      saveCurrentAnnotations().then(() => {
        prevDocRef.current = documentId
        // Load new document's annotations
        loadAnnotations()
      })
    } else if (documentId) {
      prevDocRef.current = documentId
      loadAnnotations()
    } else {
      prevDocRef.current = null
    }

    return () => {
      // Save on unmount (document switch)
      if (prevDocRef.current) {
        saveCurrentAnnotations()
      }
    }
  }, [documentId, saveCurrentAnnotations, loadAnnotations])

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
        />
      </div>
    </div>
  )
}
