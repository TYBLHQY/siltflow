import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FileText, Plus, Loader2, Highlighter, Trash2 } from "lucide-react"
import { useDocumentStore } from "@/stores/document.store"
import { useAnnotationStore } from "@/stores/annotation.store"

export function LeftPanel() {
  const {
    documents,
    currentDocument,
    setCurrentDocument,
    addDocument,
    loadFromDb,
    loading,
  } = useDocumentStore()

  const annotations = useAnnotationStore((s) => s.items)
  const queueDelete = useAnnotationStore((s) => s.queueDelete)

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

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="documents" className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between border-b px-3 py-1.5">
          <TabsList className="h-7">
            <TabsTrigger value="documents" className="text-xs px-2 py-0.5 h-6">Docs</TabsTrigger>
            <TabsTrigger value="annotations" className="text-xs px-2 py-0.5 h-6">
              Annotations
              {annotations.length > 0 && (
                <span className="ml-1 text-[10px] tabular-nums text-muted-foreground">
                  {annotations.length}
                </span>
              )}
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
                  <button
                    key={doc.id}
                    onClick={() => setCurrentDocument(doc)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      currentDocument?.id === doc.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{doc.title}</span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="annotations" className="flex-1 min-h-0 mt-0 pt-2">
          <ScrollArea className="h-full">
            {annotations.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-8 text-muted-foreground px-4">
                <Highlighter className="h-6 w-6" />
                <p className="text-xs text-center">Highlight text to add annotations</p>
              </div>
            ) : (
              <div className="space-y-0 px-1">
                {annotations.map((ann) => (
                  <div
                    key={ann.id}
                    className="group relative border-b border-border/50 px-2 py-2 hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Highlighter className="h-3 w-3 text-yellow-500 shrink-0" />
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {ann.type}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            p.{ann.pageNumber + 1}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed line-clamp-2">
                          {ann.text || `Highlight on page ${ann.pageNumber + 1}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => queueDelete(ann.id, ann.pageNumber)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
