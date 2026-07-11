import { useEffect, useState, useRef, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { IconText } from "@/components/ui/icon-text"
import { FileText, Loader2, BookText, BookMarked, BrainCircuit, FolderPlus, FileUp, FolderUp, Trash2, MoveRight } from "lucide-react"
import { useDocumentStore } from "@/stores/document.store"
import { useFolderStore } from "@/stores/folder.store"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
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
          ...(result.originalName ? { originalName: result.originalName } : {}),
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

  const handleImportFolder = async () => {
    try {
      const result = await window.siltflow.importPdfFolder()
      if (!result || result.docs.length === 0) return

      // Reload folders from backend to get all newly created ones
      await useFolderStore.getState().loadFolders(true)

      // Reload documents — force because loaded flag is set
      useDocumentStore.getState().setLoading(true)
      const docs = await window.siltflow.documents.list()
      useDocumentStore.getState().setDocuments(docs || [])
      useDocumentStore.getState().setLoading(false)
    } catch (err) {
      console.error("Folder import failed:", err)
    }
  }

  const docsTreeRef = useRef<DocsTreeHandle>(null)
  const folders = useFolderStore((s) => s.folders)
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [deleteBatchConfirm, setDeleteBatchConfirm] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null)

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedDocIds(ids)
  }, [])

  const handleBatchDelete = async () => {
    if (selectedDocIds.length === 0) return
    await window.siltflow.documents.deleteBatch(selectedDocIds)
    setDeleteBatchConfirm(false)
    setSelectedDocIds([])
    docsTreeRef.current?.clearSelection()
    // Reload docs from DB
    const docs = await window.siltflow.documents.list()
    useDocumentStore.getState().setDocuments(docs || [])
  }

  const handleBatchMove = async () => {
    if (selectedDocIds.length === 0) return
    await window.siltflow.folders.moveDocuments({ docIds: selectedDocIds, targetFolderId: moveTargetId ?? null })
    setMoveDialogOpen(false)
    setMoveTargetId(null)
    setSelectedDocIds([])
    docsTreeRef.current?.clearSelection()
    // Reload docs from DB
    const docs = await window.siltflow.documents.list()
    useDocumentStore.getState().setDocuments(docs || [])
  }

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
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        onClick={handleImport}
                      >
                        <FileUp className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6}>
                      <p className="text-xs">Import PDF</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        onClick={handleImportFolder}
                      >
                        <FolderUp className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6}>
                      <p className="text-xs">Import Folder</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      onClick={() => docsTreeRef.current?.createFolder()}
                    >
                      <FolderPlus className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    <p className="text-xs">New Folder</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          {selectedDocIds.length > 0 && (
            <div className="shrink-0 flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
              <span className="font-medium">{selectedDocIds.length} selected</span>
              <span className="text-border">·</span>
              <button
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-destructive hover:bg-destructive/10 transition-colors"
                onClick={() => setDeleteBatchConfirm(true)}
              >
                <Trash2 className="size-3" /> Delete
              </button>
              <button
                className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent transition-colors"
                onClick={() => {
                  setMoveTargetId(null)
                  setMoveDialogOpen(true)
                }}
              >
                <MoveRight className="size-3" /> Move to…
              </button>
            </div>
          )}
          <DocsTree ref={docsTreeRef} onSelectionChange={handleSelectionChange} />

          {/* ── Batch delete confirmation ── */}
          <Dialog open={deleteBatchConfirm} onOpenChange={setDeleteBatchConfirm}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Delete Documents</DialogTitle>
                <DialogDescription>
                  Delete {selectedDocIds.length} document{selectedDocIds.length > 1 ? 's' : ''}?
                  This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <button
                  className="rounded-md border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                  onClick={() => setDeleteBatchConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  onClick={handleBatchDelete}
                >
                  Delete
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Move to folder dialog ── */}
          <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Move to Folder</DialogTitle>
                <DialogDescription>
                  Select a destination folder for {selectedDocIds.length} document{selectedDocIds.length > 1 ? 's' : ''}.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1 py-2">
                <button
                  className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${moveTargetId === null ? 'bg-accent font-medium' : 'hover:bg-accent/50 text-muted-foreground'}`}
                  onClick={() => setMoveTargetId(null)}
                >
                  (Root)
                </button>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${moveTargetId === f.id ? 'bg-accent font-medium' : 'hover:bg-accent/50 text-muted-foreground'}`}
                    onClick={() => setMoveTargetId(f.id)}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              <DialogFooter>
                <button
                  className="rounded-md border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                  onClick={() => setMoveDialogOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  onClick={handleBatchMove}
                >
                  Move
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
