import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { FileText, Plus, Loader2, BookText, BookMarked, Trash2 } from "lucide-react"
import { useDocumentStore, type DocumentItem } from "@/stores/document.store"
import { usePdfViewerStore } from "@/stores/pdf-viewer.store"
import { useDocumentOutline, DocumentOutline } from "react-pdf-highlighter-plus"

function DocumentOutlinePanel() {
  const pdfDocument = usePdfViewerStore((s) => s.pdfDocument)
  const goToPage = usePdfViewerStore((s) => s.goToPage)

  const {
    outline,
    isLoading: outlineLoading,
    hasOutline,
  } = useDocumentOutline({
    pdfDocument: pdfDocument!,
    goToPage: goToPage ?? undefined,
  })

  if (!pdfDocument || outlineLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!hasOutline) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground px-4">
        <BookText className="h-8 w-8" />
        <p className="text-xs text-center">No outline available</p>
        <p className="text-xs text-center">This document doesn&apos;t have a table of contents</p>
      </div>
    )
  }

  return (
    <div className="px-1">
      <DocumentOutline
        outline={outline}
        isLoading={false}
        currentPage={0}
        onNavigate={(item) => goToPage?.(item.pageNumber)}
        classNames={{
          container: "py-2",
        }}
        itemClassNames={{
          container: "rounded-md px-2 py-1 text-sm hover:bg-accent transition-colors cursor-pointer",
          title: "text-sm",
          expandButton: "text-muted-foreground",
          expandIcon: "h-3 w-3",
        }}
      />
    </div>
  )
}

export function LeftPanel() {
  const {
    documents,
    currentDocument,
    setCurrentDocument,
    addDocument,
    removeDocument,
    loadFromDb,
    loading,
  } = useDocumentStore()

  const pdfDocument = usePdfViewerStore((s) => s.pdfDocument)

  useEffect(() => {
    loadFromDb()
  }, [loadFromDb])

  const handleImport = async () => {
    try {
      const result = await window.siltflow.selectPdf()
      if (!result) return
      await window.siltflow.documents.save({
        id: result.id,
        title: result.title,
        fileName: result.fileName,
        filePath: result.filePath,
      })
      addDocument({
        id: result.id,
        title: result.title,
        filePath: result.filePath,
      })
    } catch (err) {
      console.error("Import failed:", err)
    }
  }

  const [contextMenu, setContextMenu] = useState<{ doc: DocumentItem; x: number; y: number } | null>(null)

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [contextMenu])

  const handleDeleteDoc = async (doc: DocumentItem) => {
    await window.siltflow.documents.delete(doc.id)
    removeDocument(doc.id)
    setContextMenu(null)
  }

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="documents" className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between border-b px-3 py-1.5">
          <TabsList className="h-7">
            <TabsTrigger value="documents" className="text-xs px-2 py-0.5 h-6">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Docs
            </TabsTrigger>
            <TabsTrigger
              value="outline"
              className="text-xs px-2 py-0.5 h-6"
              disabled={!currentDocument || !pdfDocument}
            >
              <BookMarked className="h-3.5 w-3.5 mr-1" />
              Outlines
            </TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleImport}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <TabsContent value="documents" className="flex-1 min-h-0 mt-0 pt-2">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-8 text-muted-foreground px-4">
                <FileText className="h-6 w-6" />
                <p className="text-xs">No documents yet</p>
                <p className="text-xs text-center">Click + to import a PDF</p>
              </div>
            ) : (
              <div className="space-y-0.5 px-1">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer ${
                      currentDocument?.id === doc.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent"
                    }`}
                    onClick={() => setCurrentDocument(doc)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setContextMenu({ doc, x: e.clientX, y: e.clientY })
                    }}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-1 truncate min-w-0 text-left">{doc.title}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start">
                          {doc.title}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ))}
              </div>
            )}
            {contextMenu && (
              <div
                className="fixed z-50 w-28 rounded-md border bg-popover p-1 shadow-md"
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-accent"
                  onClick={() => handleDeleteDoc(contextMenu.doc)}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="outline" className="flex-1 min-h-0 mt-0 pt-2">
          {pdfDocument ? (
            <DocumentOutlinePanel />
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground px-4">
              <BookText className="h-8 w-8" />
              <p className="text-xs text-center">No document selected</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
