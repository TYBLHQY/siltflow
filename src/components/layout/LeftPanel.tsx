import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IconText } from "@/components/ui/icon-text";
import {
  FileText,
  Loader2,
  BookText,
  BookMarked,
  BrainCircuit,
  FolderPlus,
  FileUp,
  FolderUp,
  Search,
} from "lucide-react";
import { useDocumentStore } from "@/stores/document.store";
import { useFolderStore } from "@/stores/folder.store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { usePdfViewerStore } from "@/stores/pdf-viewer.store";
import {
  useDocumentOutline,
  DocumentOutline,
} from "react-pdf-highlighter-plus";
import { useAnnotationStore } from "@/stores/annotation.store";
import { useStyleStore } from "@/stores/style.store";
import {
  computeDocMetrics,
  urgencyLabel,
  type DocReviewMetrics,
} from "@/lib/doc-review";
import { DocsTree, type DocsTreeHandle } from "./DocsTree";
import { ScrollArea } from "@/components/ui/scroll-area";

function DocumentOutlinePanel() {
  const pdfDocument = usePdfViewerStore((s) => s.pdfDocument);
  const goToPage = usePdfViewerStore((s) => s.goToPage);
  const fontSize = useStyleStore((s) => s.style.fontSize);

  const {
    outline,
    isLoading: outlineLoading,
    hasOutline,
  } = useDocumentOutline({
    pdfDocument: pdfDocument!,
    goToPage: goToPage ?? undefined,
  });

  if (!pdfDocument || outlineLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasOutline) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground px-4">
        <BookText className="h-8 w-8" />
        <p className="text-xs text-center">No outline available</p>
        <p className="text-xs text-center">
          This document doesn&apos;t have a table of contents
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 px-1">
      <DocumentOutline
        outline={outline}
        isLoading={false}
        currentPage={0}
        onNavigate={(item) => goToPage?.(item.pageNumber)}
        classNames={{
          container: "py-2",
        }}
        itemClassNames={{
          container:
            "rounded-md px-2 py-1 hover:bg-accent transition-colors cursor-pointer",
          title: "hover:text-accent-foreground",
          expandButton: "text-muted-foreground",
          expandIcon: "h-3 w-3",
        }}
        itemStyles={{
          title: { fontSize },
        }}
      />
    </ScrollArea>
  );
}

interface LeftPanelProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function LeftPanel({ activeTab, onTabChange }: LeftPanelProps) {
  const {
    documents,
    currentDocument,
    setCurrentDocument,
    addDocument,
    loadFromDb,
  } = useDocumentStore();

  const pdfDocument = usePdfViewerStore((s) => s.pdfDocument);
  const annotationItems = useAnnotationStore((s) => s.items);
  const [docMetrics, setDocMetrics] = useState<DocReviewMetrics[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [reviewSearch, setReviewSearch] = useState("");
  const reviewSearchRef = useRef<HTMLInputElement>(null);
  const reviewScrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // Ctrl+F in review tab → focus search input (mount-once with ref to avoid listener churn)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        activeTabRef.current === "review" &&
        (e.ctrlKey || e.metaKey) &&
        e.key === "f"
      ) {
        e.preventDefault();
        reviewSearchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Only recompute when docMetrics change, not on every render
  const filteredMetrics = useMemo(
    () =>
      docMetrics.filter((m) =>
        m.documentTitle.toLowerCase().includes(reviewSearch.toLowerCase()),
      ),
    [docMetrics, reviewSearch],
  );

  // Compute purely from in-memory annotationItems — no loading state, no backend
  const computeMetricsFromItems = useCallback(() => {
    const docs = useDocumentStore.getState().documents;
    if (docs.length === 0) {
      setDocMetrics([]);
      return;
    }
    const items = useAnnotationStore.getState().items;
    const currentDoc = useDocumentStore.getState().currentDocument;

    // A doc is open but items is empty → last annotation was deleted
    // Reload that single doc's metrics from backend
    if (currentDoc && items.length === 0) {
      window.siltflow.fsrsCards.listByDocument(currentDoc.id).then((rows) => {
        const cardAnnIds = new Set<string>();
        const cards: import("ts-fsrs").Card[] = [];
        for (const row of rows) {
          cardAnnIds.add(row.annotationId);
          try {
            cards.push(JSON.parse(row.data));
          } catch {
            /* skip */
          }
        }
        window.siltflow.annotations.list(currentDoc.id).then((annotations) => {
          for (const ann of annotations) {
            if (!cardAnnIds.has(ann.id)) {
              cards.push({
                state: 0,
                due: new Date(),
                stability: 0,
                difficulty: 0,
                elapsed_days: 0,
                scheduled_days: 0,
                reps: 0,
                lapses: 0,
              } as import("ts-fsrs").Card);
            }
          }
          const byDoc: Record<
            string,
            { title: string; cards: import("ts-fsrs").Card[] }
          > = {
            [currentDoc.id]: { title: currentDoc.title, cards },
          };
          const fresh = computeDocMetrics(byDoc);
          setDocMetrics((prev) =>
            prev.map(
              (p) => fresh.find((f) => f.documentId === p.documentId) ?? p,
            ),
          );
        });
      });
      return;
    }

    // No items and no current doc → just closed a doc, keep backend values
    if (items.length === 0) return;

    // Incremental update: recompute only for docs in memory
    const itemDocIds = new Set(items.map((i) => i.documentId));

    setDocMetrics((prev) => {
      const otherDocs = prev.filter((p) => !itemDocIds.has(p.documentId));

      const byDoc: Record<
        string,
        { title: string; cards: import("ts-fsrs").Card[] }
      > = {};
      for (const doc of docs) {
        if (itemDocIds.has(doc.id)) {
          byDoc[doc.id] = { title: doc.title, cards: [] };
        }
      }
      const cardDocMap = new Map<string, Set<string>>();
      for (const item of items) {
        if (item.fsrsCard && byDoc[item.documentId]) {
          byDoc[item.documentId]!.cards.push(item.fsrsCard);
          if (!cardDocMap.has(item.documentId))
            cardDocMap.set(item.documentId, new Set());
          cardDocMap.get(item.documentId)!.add(item.id);
        }
      }
      for (const item of items) {
        if (!item.fsrsCard && byDoc[item.documentId]) {
          const cardIds = cardDocMap.get(item.documentId);
          if (!cardIds?.has(item.id)) {
            byDoc[item.documentId]!.cards.push({
              state: 0,
              due: new Date(),
              stability: 0,
              difficulty: 0,
              elapsed_days: 0,
              scheduled_days: 0,
              reps: 0,
              lapses: 0,
            } as import("ts-fsrs").Card);
          }
        }
      }
      const newMetrics = computeDocMetrics(byDoc);
      return [...otherDocs, ...newMetrics].sort(
        (a, b) =>
          b.compositeScore - a.compositeScore ||
          a.documentTitle.localeCompare(b.documentTitle),
      );
    });
  }, []);

  // Full load from backend + annotations (used once at startup)
  const loadMetricsFull = useCallback(async () => {
    setMetricsLoading(true);
    const docs = useDocumentStore.getState().documents;
    if (docs.length === 0) {
      setMetricsLoading(false);
      return;
    }
    try {
      const byDoc: Record<
        string,
        { title: string; cards: import("ts-fsrs").Card[] }
      > = {};
      for (const doc of docs) {
        byDoc[doc.id] = { title: doc.title, cards: [] };
      }
      for (const doc of docs) {
        const rows = await window.siltflow.fsrsCards.listByDocument(doc.id);
        const cardAnnIds = new Set<string>();
        for (const row of rows) {
          cardAnnIds.add(row.annotationId);
          try {
            const card = JSON.parse(row.data);
            byDoc[doc.id]!.cards.push(card);
          } catch {
            /* skip bad json */
          }
        }
        // Annotations without FSRS cards → "new" cards
        try {
          const annotations = await window.siltflow.annotations.list(doc.id);
          for (const ann of annotations) {
            if (!cardAnnIds.has(ann.id)) {
              byDoc[doc.id]!.cards.push({
                state: 0,
                due: new Date(),
                stability: 0,
                difficulty: 0,
                elapsed_days: 0,
                scheduled_days: 0,
                reps: 0,
                lapses: 0,
              } as import("ts-fsrs").Card);
            }
          }
        } catch {
          /* skip */
        }
      }
      setDocMetrics(computeDocMetrics(byDoc));
    } catch {
      // Fallback: from in-memory items
      computeMetricsFromItems();
    } finally {
      setMetricsLoading(false);
    }
  }, [computeMetricsFromItems]);

  // Load review metrics from backend when documents list changes
  // (initial load, import, delete).  documents.length starts as 0 and
  // changes only when docs are added or removed.
  useEffect(() => {
    if (documents.length === 0) return;
    loadMetricsFull();
  }, [documents.length, loadMetricsFull]);

  // Incremental update from in-memory items — no flash, debounced
  const metricsDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (metricsDebounceRef.current) clearTimeout(metricsDebounceRef.current);
    metricsDebounceRef.current = setTimeout(() => {
      computeMetricsFromItems();
    }, 150);
    return () => {
      if (metricsDebounceRef.current) clearTimeout(metricsDebounceRef.current);
    };
  }, [annotationItems, computeMetricsFromItems]);

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  const handleImport = async () => {
    try {
      const results = await window.siltflow.selectPdf();
      if (!results || results.length === 0) return;

      for (const result of results) {
        await window.siltflow.documents.save({
          id: result.id,
          title: result.title,
        });
        addDocument({
          id: result.id,
          title: result.title,
        });
      }
    } catch (err) {
      console.error("Import failed:", err);
    }
  };

  const handleImportFolder = async () => {
    try {
      const result = await window.siltflow.importPdfFolder();
      if (!result || result.docs.length === 0) return;

      // Reload folders from backend to get all newly created ones
      await useFolderStore.getState().loadFolders(true);

      // Reload documents — force because loaded flag is set
      useDocumentStore.getState().setLoading(true);
      const docs = await window.siltflow.documents.list();
      useDocumentStore.getState().setDocuments(docs || []);
      useDocumentStore.getState().setLoading(false);
    } catch (err) {
      console.error("Folder import failed:", err);
    }
  };

  const docsTreeRef = useRef<DocsTreeHandle>(null);

  // When switching to the docs tab with a current document, reveal it in the tree
  useEffect(() => {
    if (activeTab === "documents" && currentDocument) {
      const id = setTimeout(() => {
        docsTreeRef.current?.revealDocument(currentDocument.id);
      }, 50);
      return () => clearTimeout(id);
    }
  }, [activeTab, currentDocument]);

  // When switching to the review tab while a PDF is open, scroll the current
  // document item into view so the user can see its metrics at a glance.
  useEffect(() => {
    if (activeTab === "review" && currentDocument) {
      const id = setTimeout(() => {
        const el = reviewScrollRef.current?.querySelector(
          `[data-doc-id="${currentDocument.id}"]`,
        );
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 100);
      return () => clearTimeout(id);
    }
  }, [activeTab, currentDocument]);

  return (
    <div className="flex h-full flex-col">
      <Tabs
        defaultValue="review"
        value={activeTab ?? undefined}
        onValueChange={onTabChange}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="flex h-10 items-center border-b px-3">
          <TabsList className="w-full h-7 text-foreground">
            <TabsTrigger
              value="documents"
              className="flex-1 text-xs px-2 py-0.5 h-6"
            >
              <IconText icon={FileText} size="xs">
                Docs
              </IconText>
            </TabsTrigger>
            <TabsTrigger
              value="review"
              className="flex-1 text-xs px-2 py-0.5 h-6"
            >
              <IconText icon={BrainCircuit} size="xs">
                Review
              </IconText>
            </TabsTrigger>
            <TabsTrigger
              value="outline"
              className="flex-1 text-xs px-2 py-0.5 h-6"
              disabled={!currentDocument || !pdfDocument}
            >
              <IconText icon={BookMarked} size="xs">
                Outlines
              </IconText>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Docs tab ── */}
        <TabsContent
          value="documents"
          className="flex-1 min-h-0 mt-0 flex flex-col"
        >
          <div className="shrink-0 border-b px-3 py-0.5">
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
          <DocsTree ref={docsTreeRef} />
        </TabsContent>

        {/* ── Outline tab ── */}
        <TabsContent
          value="outline"
          className="flex-1 min-h-0 mt-0 flex flex-col"
        >
          {pdfDocument ? (
            <DocumentOutlinePanel />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground px-4">
              <p className="text-xs text-center">No document selected</p>
            </div>
          )}
        </TabsContent>

        {/* ── Review tab ── */}
        <TabsContent
          value="review"
          className="flex-1 min-h-0 mt-0 flex flex-col"
        >
          {/* Search filter bar — full-width, borderless */}
          <div className="shrink-0 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={reviewSearchRef}
                type="text"
                placeholder="Search documents..."
                value={reviewSearch}
                onChange={(e) => setReviewSearch(e.target.value)}
                className="w-full border-0 bg-transparent py-1.5 pl-8 pr-2 text-xs outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {metricsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredMetrics.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground px-4">
              <BrainCircuit className="h-8 w-8 mb-2" />
              {reviewSearch && docMetrics.length > 0 ? (
                <>
                  <p className="text-xs text-center">
                    No documents match your search
                  </p>
                  <button
                    className="text-primary hover:underline text-xs mt-1"
                    onClick={() => setReviewSearch("")}
                  >
                    Clear filter
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-center">No review data yet</p>
                  <p className="text-xs text-center">
                    Annotate and review cards to see per-document metrics
                  </p>
                </>
              )}
            </div>
          ) : (
            <ScrollArea className="flex-1" ref={reviewScrollRef as any}>
              <div className="space-y-0 w-full">
                {filteredMetrics.map((m) => (
                  <div
                    key={m.documentId}
                    data-doc-id={m.documentId}
                    className={`group relative border-b border-border/50 pl-3 py-2.5 pr-3 text-sm transition-colors cursor-pointer ${
                      currentDocument?.id === m.documentId
                        ? "before:absolute before:left-0 before:top-0 before:h-full before:w-[5px] before:bg-foreground"
                        : "hover:bg-accent"
                    }`}
                    onClick={() => {
                      const doc = documents.find((d) => d.id === m.documentId);
                      if (doc) setCurrentDocument(doc);
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span
                        className="truncate min-w-0 flex-1 select-none"
                        title={m.documentTitle}
                      >
                        {m.documentTitle}
                      </span>
                    </div>
                    {m.totalCards > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="rounded bg-blue-500/10 px-1 py-0.5 font-medium text-blue-600">
                          {m.newCardsCount} new
                        </span>
                        <span className="rounded bg-red-500/10 px-1 py-0.5 font-medium text-red-600">
                          {m.dueNowCount} due
                        </span>
                        <span className="rounded bg-orange-500/10 px-1 py-0.5 font-medium text-orange-600">
                          {m.dueSoonCount} soon
                        </span>
                        <span className="rounded bg-mauve/15 px-1 py-0.5 font-medium text-mauve">
                          {urgencyLabel(m.avgRetrievability)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
