import { useState, useCallback, useRef, useEffect } from "react";
import {
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Maximize,
  Minimize,
  Settings,
  PenLine,
  MousePointer2,
  BarChart3,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { usePdfViewerStore } from "@/stores/pdf-viewer.store";
import {
  useAnnotationStore,
  type AnnotationEmbedData,
} from "@/stores/annotation.store";
import { useDocumentStore } from "@/stores/document.store";
import { useShortcut } from "@/hooks/useShortcut";
import { UnifiedSettingsModal } from "@/components/settings/UnifiedSettingsModal";

// Lazy-load PdfViewer and StatsDashboard so their heavy transitive deps
// (pdfjs-dist ~3MB, recharts ~1.3MB) are not part of the initial bundle.
import React from "react";
const PdfViewer = React.lazy(() =>
  import("@/components/document/PdfViewer").then((m) => ({
    default: m.PdfViewer,
  }))
);
const StatsDashboard = React.lazy(() =>
  import("@/components/stats/StatsDashboard").then((m) => ({
    default: m.StatsDashboard,
  }))
);

// ---------------------------------------------------------------------------
// Page navigation — jump to page (only shown when a PDF is open)
// ---------------------------------------------------------------------------
function PageNav() {
  const goToPage = usePdfViewerStore((s) => s.goToPage);
  const currentPage = usePdfViewerStore((s) => s.currentPage);
  const pdfDocument = usePdfViewerStore((s) => s.pdfDocument);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  const totalPages = pdfDocument?.numPages ?? 0;

  const handleJump = useCallback(() => {
    const n = parseInt(input, 10);
    if (isNaN(n) || n < 1 || n > totalPages || !goToPage) {
      setInput("");
      return;
    }
    goToPage(n);
    setInput("");
  }, [input, totalPages, goToPage]);

  if (!pdfDocument || totalPages === 0) return null;

  return (
    <div className="flex items-center h-full shrink-0">
      <div className="flex items-center gap-0.5 rounded-md border border-border/50 bg-muted/40 px-2 text-xs text-foreground">
        {focused ? (
          <input
            className="w-10 bg-transparent py-0.5 text-center outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJump();
              if (e.key === "Escape") {
                setInput("");
                setFocused(false);
              }
            }}
            onBlur={() => {
              setFocused(false);
              setInput("");
            }}
            autoFocus
            placeholder={String(currentPage)}
          />
        ) : (
          <button
            className="rounded px-1 py-0.5 hover:bg-accent transition-colors"
            onClick={() => setFocused(true)}
            title="Jump to page"
          >
            {currentPage}
          </button>
        )}
        <span className="opacity-60">/ {totalPages}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick-add toggle button — placed left of fit-width in the toolbar.
// ---------------------------------------------------------------------------
function QuickAddToggle() {
  const quickAddEnabled = usePdfViewerStore((s) => s.quickAddEnabled);
  const setQuickAddEnabled = usePdfViewerStore((s) => s.setQuickAddEnabled);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-6 w-6 ${quickAddEnabled ? "bg-accent" : ""}`}
      onClick={() => setQuickAddEnabled(!quickAddEnabled)}
      title={
        quickAddEnabled
          ? "Quick-add mode (selection auto-annotates)"
          : "Manual mode (selection shows add button)"
      }
    >
      {quickAddEnabled ? (
        <PenLine className="h-4 w-4" />
      ) : (
        <MousePointer2 className="h-4 w-4" />
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Fit-to-width toggle button.  Uses setViewerScale directly so it can pass
// "page-width" / "auto" to viewer.currentScaleValue without going through the
// numeric pdfScaleValue prop (which must stay a number for proximity-check).
// ---------------------------------------------------------------------------
function FitWidthButton() {
  const fitWidth = usePdfViewerStore((s) => s.fitWidth);
  const setFitWidth = usePdfViewerStore((s) => s.setFitWidth);
  const setViewerScale = usePdfViewerStore((s) => s.setViewerScale);
  const setPdfScale = usePdfViewerStore((s) => s.setPdfScale);

  const toggle = useCallback(() => {
    if (!setViewerScale) return;
    if (fitWidth) {
      setViewerScale("auto");
      setPdfScale(undefined as unknown as number);
    } else {
      setViewerScale("page-width");
      setPdfScale(undefined as unknown as number);
    }
    setFitWidth(!fitWidth);
  }, [fitWidth, setFitWidth, setViewerScale, setPdfScale]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-6 w-6 ${fitWidth ? "bg-accent" : ""}`}
      onClick={toggle}
      title="Fit to width"
    >
      {fitWidth ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Settings button — opens unified settings dialog
// ---------------------------------------------------------------------------
function SettingsButton() {
  const [open, setOpen] = useState(false);

  // Listen for the shortcut-triggered settings toggle event
  useEffect(() => {
    const handler = () => setOpen((c) => !c);
    window.addEventListener("siltflow:toggle-settings", handler);
    return () =>
      window.removeEventListener("siltflow:toggle-settings", handler);
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setOpen(true)}
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>
      <UnifiedSettingsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

interface CenterPanelProps {
  documentPath?: string | null;
  documentId?: string | null;
  leftCollapsed?: boolean;
  rightCollapsed?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
}

export function CenterPanel({
  documentPath,
  documentId,
  leftCollapsed,
  rightCollapsed,
  onToggleLeft,
  onToggleRight,
}: CenterPanelProps) {
  const setItems = useAnnotationStore((s) => s.setItems);
  const loadedDocRef = useRef<string | null>(null);
  const currentDocument = useDocumentStore((s) => s.currentDocument);
  const currentPage = usePdfViewerStore((s) => s.currentPage);
  const [showStats, setShowStats] = useState(false);
  useShortcut("toggleStats", () => setShowStats((s) => !s));

  // Load annotations from Electron backend when document changes
  useEffect(() => {
    if (!documentId) {
      setItems([]);
      loadedDocRef.current = null;
      return;
    }

    loadedDocRef.current = documentId;

    window.siltflow.annotations.list(documentId).then(async (saved) => {
      if (loadedDocRef.current !== documentId) return;

      // Load ai_results and fsrs_cards for all annotations in batch (2 calls instead of 2N)
      const [aiRows, fsrsRows] = await Promise.all([
        window.siltflow.aiResults.listByDocument(documentId).catch(() => [] as { annotationId: string; data: string }[]),
        window.siltflow.fsrsCards.listByDocument(documentId).catch(() => [] as { annotationId: string; data: string }[]),
      ]);

      const aiResults = new Map<string, any>();
      for (const r of aiRows) {
        try { aiResults.set(r.annotationId, JSON.parse(r.data)); } catch { /* skip */ }
      }
      const fsrsCards = new Map<string, any>();
      for (const r of fsrsRows) {
        try { fsrsCards.set(r.annotationId, JSON.parse(r.data)); } catch { /* skip */ }
      }

      setItems(
        (saved || []).map((a: any) => ({
          id: a.id,
          documentId: a.documentId,
          type: a.type,
          text: a.text || "",
          pageNumber: a.pageNumber ?? 1,
          embedData: JSON.parse(a.embedData) as AnnotationEmbedData,
          aiResult: aiResults.get(a.id) ?? undefined,
          fsrsCard: fsrsCards.get(a.id) ?? undefined,
        })),
      );
    });
  }, [documentId, setItems]);

  const docTitle = currentDocument?.title ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* ── unified toolbar ── */}
      <div className="flex h-10 items-center gap-1 border-b px-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onToggleLeft}
        >
          {leftCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setShowStats(true)}
          title="Statistics (Ctrl+D)"
        >
          <BarChart3 className="h-4 w-4" />
        </Button>

        <h1 className="flex-1 truncate text-center text-sm font-medium min-w-0">
          {docTitle || "Siltflow"}
        </h1>

        <div className="flex items-center gap-2 shrink-0">
          {docTitle && <PageNav />}
          {docTitle && <QuickAddToggle />}
          {docTitle && <FitWidthButton />}
          <SettingsButton />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onToggleRight}
          >
            {rightCollapsed ? (
              <PanelRightOpen className="h-4 w-4" />
            ) : (
              <PanelRightClose className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* ── content ── */}
      {docTitle ? (
        <div className="flex-1 min-h-0 relative">
          {/* Sticky progress bar */}
          <div className="absolute top-0 left-0 right-0 z-10 h-1 pointer-events-none">
            <div className="relative h-full w-full bg-teal/10">
              <div
                className="absolute inset-y-0 left-0 bg-sky transition-[width] duration-150 ease-out"
                style={{
                  width: currentDocument?.totalPages
                    ? `${(Math.min(currentPage, currentDocument.totalPages) / currentDocument.totalPages) * 100}%`
                    : "0%",
                }}
              />
            </div>
          </div>
          <React.Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <PdfViewer
              className="h-full w-full"
              src={documentPath!}
              documentId={documentId!}
            />
          </React.Suspense>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <BookOpen className="h-12 w-12" />
            <p className="text-sm">Select a document to start reading</p>
          </div>
        </div>
      )}

      {/* ── Statistics Dashboard Dialog ── */}
      <Dialog open={showStats} onOpenChange={(open) => { if (!open) setShowStats(false); }}>
        <DialogContent
          hideClose
          className="flex w-full max-w-5xl h-[calc(100vh-80px)] rounded-lg border bg-background shadow-xl p-0 gap-0"
        >
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <StatsDashboard onClose={() => setShowStats(false)} />
          </React.Suspense>
        </DialogContent>
      </Dialog>
    </div>
  );
}
