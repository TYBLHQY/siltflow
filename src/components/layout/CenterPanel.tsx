import { useRef, useEffect, useCallback } from "react"
import { BookOpen } from "lucide-react"
import { PdfViewer, type PdfViewerHandle } from "@/components/document/PdfViewer"
import { useAnnotationStore } from "@/stores/annotation.store"

interface CenterPanelProps {
  documentPath?: string | null
  documentId?: string | null
}

export function CenterPanel({ documentPath, documentId }: CenterPanelProps) {
  const pdfRef = useRef<PdfViewerHandle>(null)
  const prevDocRef = useRef<string | null>(null)
  const setItems = useAnnotationStore((s) => s.setItems)

  // Convert TransferItem from embedPDF to our AnnotationItem format
  const syncAnnotationsToStore = useCallback(async () => {
    if (!documentId) return
    const items = await pdfRef.current?.saveAnnotations()
    if (items) {
      setItems(
        items.map((item) => ({
          id: item.annotation.id,
          documentId: documentId!,
          type: item.annotation.type || "highlight",
          text: (item.annotation as any).text || "",
          pageNumber: item.annotation.page || 0,
          embedData: item,
        }))
      )
    }
  }, [documentId, setItems])

  const saveCurrentAnnotations = useCallback(async () => {
    if (!prevDocRef.current) return
    try {
      const items = await pdfRef.current?.saveAnnotations()
      if (items && items.length > 0) {
        // Delete old annotations for this doc, then insert fresh
        for (const item of items) {
          const existing = await window.siltflow.annotations.list(prevDocRef.current)
          const found = existing?.find((a: any) => a.id === item.annotation.id)
          if (!found) {
            await window.siltflow.annotations.save({
              id: item.annotation.id,
              documentId: prevDocRef.current,
              type: item.annotation.type || "highlight",
              text: (item.annotation as any).text || "",
              pageNumber: item.annotation.page || 0,
              embedData: JSON.stringify(item),
            })
          }
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
        setItems(saved)
      } else {
        setItems([])
      }
    } catch (err) {
      console.error("Failed to load annotations:", err)
    }
  }, [documentId, setItems])

  // Handle document switching
  useEffect(() => {
    if (documentId && documentId !== prevDocRef.current) {
      saveCurrentAnnotations().then(() => {
        prevDocRef.current = documentId
        loadAnnotations()
      })
    } else if (documentId) {
      prevDocRef.current = documentId
      loadAnnotations()
    } else {
      prevDocRef.current = null
      setItems([])
    }

    return () => {
      if (prevDocRef.current) {
        saveCurrentAnnotations()
      }
    }
  }, [documentId, saveCurrentAnnotations, loadAnnotations, setItems])

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
