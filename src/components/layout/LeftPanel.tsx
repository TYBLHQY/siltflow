import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Plus, Loader2 } from "lucide-react"
import { useDocumentStore } from "@/stores/document.store"

export function LeftPanel() {
  const {
    documents,
    currentDocument,
    setCurrentDocument,
    addDocument,
    loadFromDb,
    loading,
  } = useDocumentStore()

  // Load documents from DB on mount
  useEffect(() => {
    loadFromDb()
  }, [loadFromDb])

  const handleImport = async () => {
    try {
      const result = await window.siltflow.selectPdf()
      if (!result) return

      // Save to database
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
      <div className="flex h-10 items-center justify-between border-b px-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Documents</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleImport}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-8 text-muted-foreground">
            <FileText className="h-6 w-6" />
            <p className="text-xs">No documents yet</p>
            <p className="text-xs text-center px-4">
              Click + to import a PDF
            </p>
          </div>
        ) : (
          <div className="space-y-1">
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
      <Separator />
      <div className="p-3">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Review Queue</h2>
        <p className="text-xs text-muted-foreground">No documents due</p>
      </div>
    </div>
  )
}
