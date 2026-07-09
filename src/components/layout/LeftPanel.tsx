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
          <PagesTab thumbApi={thumbApi} />
        </TabsContent>

        <TabsContent value="outline" className="flex-1 min-h-0 mt-0 pt-2">
          <OutlineTab bookmarkApi={bookmarkApi} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PagesTab({ thumbApi }: { thumbApi: PdfApiStore["thumbApi"] }) {
  const [thumbs, setThumbs] = useState<{ idx: number; url: string }[]>([])

  useEffect(() => {
    if (!thumbApi) return
    const load = async () => {
      const results: { idx: number; url: string }[] = []
      for (let i = 0; i < thumbApi.totalPages; i++) {
        const blob = await thumbApi.renderThumb(i, 1)
        if (blob) results.push({ idx: i, url: URL.createObjectURL(blob) })
      }
      setThumbs(results)
    }
    load()
    return () => thumbs.forEach((t) => URL.revokeObjectURL(t.url))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbApi?.totalPages])

  if (!thumbApi) {
    return (
      <div className="flex flex-col items-center gap-1 py-8 text-muted-foreground px-4">
        <LayoutTemplate className="h-6 w-6" />
        <p className="text-xs">Open a document to see pages</p>
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
            onClick={() => thumbApi.scrollTo(t.idx)}
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

function OutlineTab({ bookmarkApi }: { bookmarkApi: PdfApiStore["bookmarkApi"] }) {
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    if (!bookmarkApi) return
    bookmarkApi.getBookmarks().then(setItems)
  }, [bookmarkApi])

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
          <OutlineItem key={i} item={item} depth={0} />
        ))}
      </div>
    </ScrollArea>
  )
}

function OutlineItem({ item, depth }: { item: any; depth: number }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = item.children?.length > 0

  return (
    <div>
      <button
        className="flex items-center gap-1 w-full text-left rounded px-2 py-1 text-xs hover:bg-accent/30 transition-colors"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
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
        {item.page !== undefined && (
          <span className="text-muted-foreground ml-auto tabular-nums">p.{item.page + 1}</span>
        )}
      </button>
      {expanded && hasChildren && (
        <div>
          {item.children.map((child: any, i: number) => (
            <OutlineItem key={i} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
