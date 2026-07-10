import { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { FileText, Plus, Loader2, BookText, BookMarked, Trash2, BrainCircuit } from "lucide-react"
import { useDocumentStore, type DocumentItem } from "@/stores/document.store"
import { usePdfViewerStore } from "@/stores/pdf-viewer.store"
import { useDocumentOutline, DocumentOutline } from "react-pdf-highlighter-plus"
import { useAnnotationStore } from "@/stores/annotation.store"
import { computeDocMetrics, urgencyLabel, type DocReviewMetrics } from "@/lib/doc-review"

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
  const annotationItems = useAnnotationStore((s) => s.items)
  const [docMetrics, setDocMetrics] = useState<DocReviewMetrics[]>([])
  const [metricsLoading, setMetricsLoading] = useState(false)

  // Load per-document FSRS metrics directly from backend on mount and when annotations change
  useEffect(() => {
    let cancelled = false
    async function loadMetrics() {
      setMetricsLoading(true)
      try {
        const byDoc: Record<string, { title: string; cards: import("ts-fsrs").Card[] }> = {}
        for (const doc of documents) {
          byDoc[doc.id] = { title: doc.title, cards: [] }
        }
        for (const doc of documents) {
          const rows = await window.siltflow.fsrsCards.listByDocument(doc.id)
          for (const row of rows) {
            try {
              const card = JSON.parse(row.data)
              byDoc[doc.id]!.cards.push(card)
            } catch { /* skip bad json */ }
          }
        }
        if (!cancelled) {
          setDocMetrics(computeDocMetrics(byDoc))
        }
      } catch {
        if (!cancelled) {
          const byDoc: Record<string, { title: string; cards: import("ts-fsrs").Card[] }> = {}
          for (const doc of documents) {
            byDoc[doc.id] = { title: doc.title, cards: [] }
          }
          for (const item of annotationItems) {
            if (item.fsrsCard && byDoc[item.documentId]) {
              byDoc[item.documentId]!.cards.push(item.fsrsCard)
            }
          }
          setDocMetrics(computeDocMetrics(byDoc))
        }
      } finally {
        if (!cancelled) setMetricsLoading(false)
      }
    }
    loadMetrics()
    return () => { cancelled = true }
  }, [documents, annotationItems])

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
      <Tabs defaultValue="review" className="flex flex-col flex-1 min-h-0">
        <div className="border-b px-3 py-1.5">
          <TabsList className="h-7">
            <TabsTrigger value="documents" className="text-xs px-2 py-0.5 h-6">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Docs
            </TabsTrigger>
            <TabsTrigger value="review" className="text-xs px-2 py-0.5 h-6">
              <BrainCircuit className="h-3.5 w-3.5 mr-1" />
              Review
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
        </div>

        {/* ── Docs tab ── */}
        <TabsContent value="documents" className="flex-1 min-h-0 mt-0 flex flex-col">
          <div className="shrink-0 border-b px-3 py-2">
            <button
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={handleImport}
            >
              <Plus className="h-3.5 w-3.5" />
              Import PDF
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground px-4">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-xs text-center">No documents yet</p>
              <p className="text-xs text-center">Click Import PDF to add one</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="space-y-0 w-full">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`group relative border-b border-border/50 px-3 py-2.5 text-sm transition-colors cursor-pointer ${
                      currentDocument?.id === doc.id ? "bg-accent text-accent-foreground" : "hover:bg-accent"
                    }`}
                    onClick={() => setCurrentDocument(doc)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setContextMenu({ doc, x: e.clientX, y: e.clientY })
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate min-w-0 flex-1">{doc.title}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="start">
                            {doc.title}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                ))}
              </div>
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
        </TabsContent>

        {/* ── Outline tab ── */}
        <TabsContent value="outline" className="flex-1 min-h-0 mt-0 flex flex-col">
          {pdfDocument ? (
            <DocumentOutlinePanel />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground px-4">
              <p className="text-xs text-center">No document selected</p>
            </div>
          )}
        </TabsContent>

        {/* ── Review tab ── */}
        <TabsContent value="review" className="flex-1 min-h-0 mt-0 flex flex-col">
          {metricsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : docMetrics.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground px-4">
              <BrainCircuit className="h-8 w-8 mb-2" />
              <p className="text-xs text-center">No review data yet</p>
              <p className="text-xs text-center">Annotate and review cards to see per-document metrics</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="space-y-0 w-full">
                {docMetrics.map((m) => (
                  <div
                    key={m.documentId}
                    className={`group relative border-b border-border/50 px-3 py-2.5 text-sm transition-colors cursor-pointer ${
                      currentDocument?.id === m.documentId ? "bg-accent text-accent-foreground" : "hover:bg-accent"
                    }`}
                    onClick={() => {
                      const doc = documents.find((d) => d.id === m.documentId)
                      if (doc) setCurrentDocument(doc)
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate min-w-0 flex-1">{m.documentTitle}</span>
                    </div>
                    {m.totalCards > 0 && (
                      <div className="flex items-center gap-2 mt-0.5">
                        {m.dueNowCount > 0 && (
                          <span className="rounded bg-red-500/10 px-1 py-0.5 text-[9px] font-medium text-red-600">{m.dueNowCount} due</span>
                        )}
                        {m.dueSoonCount > 0 && (
                          <span className="rounded bg-orange-500/10 px-1 py-0.5 text-[9px] font-medium text-orange-600">{m.dueSoonCount} soon</span>
                        )}
                        {m.avgRetrievability > 0 && (
                          <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                            m.avgRetrievability >= 90 ? "bg-green-500/10 text-green-600" :
                            m.avgRetrievability >= 75 ? "bg-blue-500/10 text-blue-600" :
                            m.avgRetrievability >= 50 ? "bg-yellow-500/10 text-yellow-600" :
                            "bg-red-500/10 text-red-600"
                          }`}>{urgencyLabel(m.avgRetrievability)}</span>
                        )}
                        <span className="text-[9px] text-muted-foreground ml-auto">{m.totalCards}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
