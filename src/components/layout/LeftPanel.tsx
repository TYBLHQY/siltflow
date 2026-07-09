import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  FileText, Plus, Loader2, Highlighter, Trash2,
  LayoutTemplate, ListTree,
} from "lucide-react"
import { useDocumentStore } from "@/stores/document.store"
import { useAnnotationStore } from "@/stores/annotation.store"
import { usePdfApiStore } from "@/stores/pdf-api.store"

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

  const thumbApi = usePdfApiStore((s) => s.thumbApi)
  const bookmarkApi = usePdfApiStore((s) => s.bookmarkApi)
  const scrollApi = usePdfApiStore((s) => s.scrollApi)

  const [tab, setTab] = useState("documents")

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

  // When switching to pages/outline tabs without a document, switch back
  const handleTabChange = (v: string) => {
    if ((v === "pages" || v === "outline") && !currentDocument) return
    setTab(v)
  }

  return (
    <div className="flex h-full flex-col">
      <Tabs value={tab} onValueChange={handleTabChange} className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between border-b px-3 py-1.5">
          <TabsList className="h-7">
            <TabsTrigger value="documents" className="text-xs px-2 py-0.5 h-6">Docs</TabsTrigger>
            <TabsTrigger value="pages" className="text-xs px-2 py-0.5 h-6" disabled={!currentDocument}>
              <LayoutTemplate className="h-3 w-3 mr-1" />Pages
            </TabsTrigger>
            <TabsTrigger value="outline" className="text-xs px-2 py-0.5 h-6" disabled={!currentDocument}>
              <ListTree className="h-3 w-3 mr-1" />Outline
            </TabsTrigger>
          </TabsList>
          {tab === "documents" && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleImport}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
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
                    onClick={() => { setCurrentDocument(doc); setTab("pages") }}
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

        <TabsContent value="pages" className="flex-1 min-h-0 mt-0 pt-2">
          <PagesTab thumbApi={thumbApi} scrollApi={scrollApi} />
        </TabsContent>

        <TabsContent value="outline" className="flex-1 min-h-0 mt-0 pt-2">
          <OutlineTab bookmarkApi={bookmarkApi} scrollApi={scrollApi} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PagesTab({
  thumbApi,
  scrollApi,
}: {
  thumbApi: PdfApiStore["thumbApi"]
  scrollApi: PdfApiStore["scrollApi"]
}) {
  const [thumbs, setThumbs] = useState<{ idx: number; url: string }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!thumbApi || thumbApi.totalPages === 0) return
    let cancelled = false
    setLoading(true)
    const load = async () => {
      const results: { idx: number; url: string }[] = []
      for (let i = 0; i < thumbApi.totalPages; i++) {
        if (cancelled) break
        const blob = await thumbApi.renderThumb(i, 2)
        if (blob) results.push({ idx: i, url: URL.createObjectURL(blob) })
      }
      if (!cancelled) {
        setThumbs(results)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      thumbs.forEach((t) => URL.revokeObjectURL(t.url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbApi?.totalPages])

  if (!thumbApi || thumbApi.totalPages === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-8 text-muted-foreground px-4">
        <LayoutTemplate className="h-6 w-6" />
        <p className="text-xs">Open a document to see pages</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 px-2 pb-4">
        {thumbs.map((t) => (
          <button
            key={t.idx}
            className="w-full rounded border hover:bg-accent/30 transition-colors overflow-hidden"
            onClick={() => scrollApi?.scrollToPage(t.idx)}
          >
            <img src={t.url} alt={`Page ${t.idx + 1}`} className="w-full object-contain" />
            <div className="text-[10px] text-center text-muted-foreground py-0.5">
              p.{t.idx + 1}
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}

function OutlineTab({
  bookmarkApi,
  scrollApi,
}: {
  bookmarkApi: PdfApiStore["bookmarkApi"]
  scrollApi: PdfApiStore["scrollApi"]
}) {
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    if (!bookmarkApi) return
    bookmarkApi.getBookmarks().then(setItems)
  }, [bookmarkApi])

  const navigate = useCallback(
    (target: any) => {
      const pageIndex = target?.destination?.pageIndex ?? target?.pageIndex
      if (pageIndex !== undefined && scrollApi) {
        scrollApi.scrollToPage(pageIndex)
      }
    },
    [scrollApi]
  )

  if (!bookmarkApi) {
    return (
      <div className="flex flex-col items-center gap-1 py-8 text-muted-foreground px-4">
        <ListTree className="h-6 w-6" />
        <p className="text-xs">Open a document to see outline</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-8 text-muted-foreground px-4">
        <ListTree className="h-6 w-6" />
        <p className="text-xs">No outline in this document</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="px-2 pb-4 space-y-0.5">
        {items.map((item: any, i: number) => (
          <OutlineItem key={i} item={item} depth={0} onNavigate={navigate} />
        ))}
      </div>
    </ScrollArea>
  )
}

function OutlineItem({
  item,
  depth,
  onNavigate,
}: {
  item: any
  depth: number
  onNavigate: (target: any) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = item.children?.length > 0
  const pageIndex = item.target?.destination?.pageIndex ?? item.target?.pageIndex

  return (
    <div>
      <button
        className="flex items-center gap-1 w-full text-left rounded px-2 py-1 text-xs hover:bg-accent/30 transition-colors"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => onNavigate(item.target)}
      >
        {hasChildren && (
          <span
            className="text-muted-foreground cursor-pointer shrink-0"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          >
            {expanded ? "▾" : "▸"}
          </span>
        )}
        <span className="truncate">{item.title}</span>
        {pageIndex !== undefined && (
          <span className="text-muted-foreground ml-auto tabular-nums">p.{pageIndex + 1}</span>
        )}
      </button>
      {expanded && hasChildren && (
        <div>
          {item.children.map((child: any, i: number) => (
            <OutlineItem key={i} item={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}
