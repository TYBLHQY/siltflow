import { useEffect, useState, useRef } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { IconText } from "@/components/ui/icon-text"
import { FileText, Plus, Loader2, BookText, BookMarked, BrainCircuit, FolderPlus } from "lucide-react"
import { useDocumentStore } from "@/stores/document.store"
import { usePdfViewerStore } from "@/stores/pdf-viewer.store"
import { useDocumentOutline, DocumentOutline } from "react-pdf-highlighter-plus"
import { useAnnotationStore } from "@/stores/annotation.store"
import { computeDocMetrics, urgencyLabel, type DocReviewMetrics } from "@/lib/doc-review"
import { DocsTree, type DocsTreeHandle } from "./DocsTree"

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

interface LeftPanelProps {
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export function LeftPanel({ activeTab, onTabChange }: LeftPanelProps) {
  const {
    documents,
    currentDocument,
    setCurrentDocument,
    addDocument,
    loadFromDb,
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
      const results = await window.siltflow.selectPdf()
      if (!results || results.length === 0) return

      for (const result of results) {
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
      }
    } catch (err) {
      console.error("Import failed:", err)
    }
  }

  const docsTreeRef = useRef<DocsTreeHandle>(null)

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="review" value={activeTab ?? undefined} onValueChange={onTabChange} className="flex flex-col flex-1 min-h-0">
        <div className="flex h-10 items-center border-b px-3">
          <TabsList className="w-full h-7 text-foreground">
            <TabsTrigger value="documents" className="flex-1 text-xs px-2 py-0.5 h-6">
              <IconText icon={FileText} size="xs">Docs</IconText>
            </TabsTrigger>
            <TabsTrigger value="review" className="flex-1 text-xs px-2 py-0.5 h-6">
              <IconText icon={BrainCircuit} size="xs">Review</IconText>
            </TabsTrigger>
            <TabsTrigger
              value="outline"
              className="flex-1 text-xs px-2 py-0.5 h-6"
              disabled={!currentDocument || !pdfDocument}
            >
              <IconText icon={BookMarked} size="xs">Outlines</IconText>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Docs tab ── */}
        <TabsContent value="documents" className="flex-1 min-h-0 mt-0 flex flex-col">
          <div className="shrink-0 border-b px-3 py-2">
            <div className="flex gap-2">
              <button
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                onClick={handleImport}
              >
                <IconText icon={Plus} size="xs" className="gap-0">
                  Import PDF
                </IconText>
              </button>
              <button
                className="flex items-center justify-center gap-1 rounded-md border border-border/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                onClick={() => docsTreeRef.current?.createFolder()}
              >
                <IconText icon={FolderPlus} size="xs" className="gap-0">
                  Folder
                </IconText>
              </button>
            </div>
          </div>
          <DocsTree ref={docsTreeRef} />
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
                      currentDocument?.id === m.documentId ? "bg-accent" : "hover:bg-accent"
                    }`}
                    onClick={() => {
                      const doc = documents.find((d) => d.id === m.documentId)
                      if (doc) setCurrentDocument(doc)
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate min-w-0 flex-1" title={m.documentTitle}>{m.documentTitle}</span>
                    </div>
                    {m.totalCards > 0 && (
                      <div className="flex items-center gap-2 mt-0.5">
                        {m.dueNowCount > 0 && (
                          <span className="rounded bg-red-500/10 px-1 py-0.5 font-medium text-red-600">{m.dueNowCount} due</span>
                        )}
                        {m.dueSoonCount > 0 && (
                          <span className="rounded bg-orange-500/10 px-1 py-0.5 font-medium text-orange-600">{m.dueSoonCount} soon</span>
                        )}
                        {m.avgRetrievability > 0 && (
                          <span className="rounded bg-mauve/15 px-1 py-0.5 font-medium text-mauve">{urgencyLabel(m.avgRetrievability)}</span>
                        )}
                        <span className="text-muted-foreground ml-auto">{m.totalCards} cards</span>
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
