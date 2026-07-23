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
  Search,
  PenLine,
  MousePointer2,
  Highlighter,
  BarChart3,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { usePdfViewerStore, pdfGoToPage, pdfSetViewerScale, type SelectionMode } from "@/stores/pdf-viewer.store";
import {
  useAnnotationStore,
  type AnnotationEmbedData,
} from "@/stores/annotation.store";
import { useDocumentStore } from "@/stores/document.store";
import { useStyleStore } from "@/stores/style.store";
import { useSearchStore } from "@/stores/search.store";
import { resolveHighlightCSSVar } from "@/lib/colors";
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
  const currentPage = usePdfViewerStore((s) => s.currentPage);
  const pdfDocument = usePdfViewerStore((s) => s.pdfDocument);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  const totalPages = pdfDocument?.numPages ?? 0;

  const handleJump = useCallback(() => {
    const n = parseInt(input, 10);
    if (isNaN(n) || n < 1 || n > totalPages) {
      setInput("");
      return;
    }
    pdfGoToPage(n);
    setInput("");
  }, [input, totalPages]);

  if (!pdfDocument || totalPages === 0) return null;

  return (
    <div className="flex items-center h-full shrink-0">
      <div className="flex items-center gap-0.5 rounded-md border border-ctp-overlay0/50 bg-ctp-surface0/40 px-2 text-xs text-ctp-text">
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
            className="rounded px-1 py-0.5 hover:bg-ctp-surface0 transition-colors"
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
// Selection-mode toggle — 3-way cycling button.
// Cycles: manual → auto-annotate → auto-highlight → manual …
// ---------------------------------------------------------------------------

const MODES: Array<{
  mode: SelectionMode;
  icon: typeof PenLine;
  title: string;
}> = [
  {
    mode: "manual",
    icon: MousePointer2,
    title: "Manual mode: select text then choose annotation or highlight",
  },
  {
    mode: "auto-annotate",
    icon: PenLine,
    title: "Auto-annotate: selection immediately creates an annotation",
  },
  {
    mode: "auto-highlight",
    icon: Highlighter,
    title: "Auto-highlight: selection creates a plain colored highlight only",
  },
];

function QuickAddToggle() {
  const selectionMode = usePdfViewerStore((s) => s.selectionMode);
  const setSelectionMode = usePdfViewerStore((s) => s.setSelectionMode);
  const annotationColor = useStyleStore((s) => s.style.annotationHighlightColor);
  const plainColor = useStyleStore((s) => s.style.plainHighlightColor);

  const currentIndex = MODES.findIndex((m) => m.mode === selectionMode);
  const current = MODES[currentIndex] ?? MODES[1];
  const Icon = current.icon;

  const cycle = useCallback(() => {
    const nextIndex = (currentIndex + 1) % MODES.length;
    setSelectionMode(MODES[nextIndex].mode);
  }, [currentIndex, setSelectionMode]);

  // Compute colored background for annotation / highlight modes.
  const annoCSSVar = resolveHighlightCSSVar(annotationColor);
  const plainCSSVar = resolveHighlightCSSVar(plainColor);

  let toggleStyle: React.CSSProperties | undefined;
  if (selectionMode === "auto-annotate" && annoCSSVar) {
    toggleStyle = {
      backgroundColor: `color-mix(in srgb, ${annoCSSVar} 42%, transparent)`,
    };
  } else if (selectionMode === "auto-highlight" && plainCSSVar) {
    toggleStyle = {
      backgroundColor: `color-mix(in srgb, ${plainCSSVar} 42%, transparent)`,
    };
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      style={toggleStyle}
      onClick={cycle}
      title={current.title}
    >
      <Icon className="h-4 w-4" />
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
  const setPdfScale = usePdfViewerStore((s) => s.setPdfScale);

  const toggle = useCallback(() => {
    if (fitWidth) {
      pdfSetViewerScale("auto");
      setPdfScale(undefined as unknown as number);
    } else {
      pdfSetViewerScale("page-width");
      setPdfScale(undefined as unknown as number);
    }
    setFitWidth(!fitWidth);
  }, [fitWidth, setFitWidth, setPdfScale]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-6 w-6 ${fitWidth ? "bg-ctp-surface0" : ""}`}
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

      setItems(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (saved || []).reverse().map((a: any) => ({
          id: a.id,
          documentId: a.document_id,
          type: a.type,
          kind: a.kind || "annotation",
          text: a.text || "",
          pageNumber: a.page_number ?? 1,
          embedData: a.embed_data as AnnotationEmbedData,
          aiResult: a.ai_data ?? undefined,
          aiVersion: a.ai_version ?? undefined,
          fsrsCard: a.fsrs_data ?? undefined,
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
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => useSearchStore.getState().open()}
          title="Search annotations (Ctrl+F)"
        >
          <Search className="h-4 w-4" />
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
            <div className="relative h-full w-full bg-ctp-teal/10">
              <div
                className="absolute inset-y-0 left-0 bg-ctp-sky transition-[width] duration-150 ease-out"
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
                <Loader2 className="h-6 w-6 animate-spin text-ctp-overlay0" />
              </div>
            }
          >
            <ErrorBoundary>
              <PdfViewer
                className="h-full w-full"
                src={documentPath!}
                documentId={documentId!}
              />
            </ErrorBoundary>
          </React.Suspense>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-ctp-overlay0">
            <BookOpen className="h-12 w-12" />
            <p className="text-sm">Select a document to start reading</p>
          </div>
        </div>
      )}

      {/* ── Statistics Dashboard Dialog ── */}
      <Dialog open={showStats} onOpenChange={(open) => { if (!open) setShowStats(false); }}>
        <DialogContent
          hideClose
          className="flex w-full max-w-5xl h-[calc(100vh-80px)] rounded-lg border bg-ctp-base shadow-xl p-0 gap-0"
        >
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-ctp-overlay0" />
              </div>
            }
          >
            <ErrorBoundary>
              <StatsDashboard onClose={() => setShowStats(false)} />
            </ErrorBoundary>
          </React.Suspense>
        </DialogContent>
      </Dialog>
    </div>
  );
}
