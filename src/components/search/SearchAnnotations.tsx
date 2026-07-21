import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Highlighter, SearchX } from "lucide-react";
import { useSearchStore } from "@/stores/search.store";
import { useDocumentStore } from "@/stores/document.store";
import { usePdfViewerStore, pdfScrollToHighlight } from "@/stores/pdf-viewer.store";
import { SearchResultItem } from "./SearchResultItem";
import { AnnotationSearchCard } from "./AnnotationSearchCard";
import type { SearchEntry } from "@/stores/search.store";

/**
 * Navigate to an annotation — switch document, scroll PDF highlight,
 * scroll right panel card.
 */
async function navigateToAnnotation(entry: SearchEntry) {
  const { setCurrentDocument, currentDocument } = useDocumentStore.getState();
  const searchStore = useSearchStore.getState();

  // Close search dialog
  searchStore.close();

  // Switch document if needed
  if (currentDocument?.id !== entry.documentId) {
    const docs = useDocumentStore.getState().documents;
    const doc = docs.find((d) => d.id === entry.documentId);
    if (doc) {
      setCurrentDocument(doc);

      // Wait for PDF viewer to mount
      await new Promise<void>((resolve) => {
        const start = Date.now();
        const check = () => {
          const pdfDoc = usePdfViewerStore.getState().pdfDocument;
          if (pdfDoc) {
            resolve();
          } else if (Date.now() - start > 3000) {
            resolve(); // timeout — skip scroll
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    }
  }

  // Scroll PDF to highlight (non-manual only)
  if (entry.annotation.kind !== "manual") {
    // Small delay to let the PDF viewer finish rendering
    setTimeout(() => {
      pdfScrollToHighlight(entry.annotation.id);
    }, 150);
  }

  // Dispatch annotation-click event to scroll right panel card
  window.dispatchEvent(
    new CustomEvent("siltflow:annotation-click", {
      detail: { id: entry.annotation.id },
    }),
  );
}

export function SearchAnnotations() {
  const {
    isOpen,
    close,
    query,
    setQuery,
    results,
    selectedIndex,
    setSelectedIndex,
    selectedEntry,
    selectEntry,
    entries,
    indexBuilt,
    isBuilding,
    buildIndex,
  } = useSearchStore();

  const [isWide, setIsWide] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Detect wide viewport
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsWide(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Build index on first open
  useEffect(() => {
    if (isOpen && !indexBuilt && !isBuilding) {
      buildIndex();
    }
  }, [isOpen, indexBuilt, isBuilding, buildIndex]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay so the Dialog animation doesn't steal focus
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector("[data-search-selected]");
      if (el) {
        el.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // ── Keyboard navigation ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (selectedEntry) {
        // Card is open — Esc closes card
        if (e.key === "Escape") {
          e.preventDefault();
          selectEntry(null);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(
            results.length > 0
              ? (selectedIndex + 1) % results.length
              : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(
            results.length > 0
              ? (selectedIndex - 1 + results.length) % results.length
              : 0,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (results.length > 0) {
            const idx = Math.min(selectedIndex, results.length - 1);
            navigateToAnnotation(results[idx].item);
          }
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
      }
    },
    [results, selectedIndex, setSelectedIndex, selectedEntry, close],
  );

  // ── Jump to / View card handlers ──
  const handleJumpTo = useCallback(
    (entry: SearchEntry) => {
      navigateToAnnotation(entry);
    },
    [],
  );

  const handleViewCard = useCallback(
    (entry: SearchEntry) => {
      selectEntry(entry);
    },
    [selectEntry],
  );

  // ── Filter results with highlights ──
  const hasQuery = query.trim().length > 0;
  const hasAnnotations = entries.length > 0;

  const totalDocuments = useMemo(() => {
    const seen = new Set(entries.map((e) => e.documentId));
    return seen.size;
  }, [entries]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent
        hideClose
        className="flex flex-col w-full max-w-3xl h-137.5 max-h-[80vh] rounded-lg border bg-ctp-base shadow-xl p-0 gap-0 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* ── Search input ── */}
        <div className="relative shrink-0 border-b border-ctp-overlay0/20">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ctp-overlay0 shrink-0" />
          <input
            ref={inputRef}
            className="w-full bg-transparent pl-9 pr-4 py-3 text-sm outline-none placeholder:text-ctp-overlay0"
            placeholder="Search annotations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* ── Body: results + detail card ── */}
        <div className="flex-1 min-h-0 flex">
          {/* ── Results panel ── */}
          <div
            className={`flex-1 min-w-0 flex flex-col transition-all duration-300
              ${isWide && selectedEntry ? "md:w-1/2 md:flex-initial" : ""}
            `}
          >
            {/* loading */}
            {isBuilding && (
              <div className="flex-1 flex items-center justify-center gap-2 text-sm text-ctp-overlay0">
                <Loader2 className="h-5 w-5 animate-spin" />
                Indexing annotations…
              </div>
            )}

            {/* empty annotations */}
            {!isBuilding && !hasAnnotations && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-ctp-overlay0 px-4">
                <Highlighter className="h-8 w-8" />
                <p className="text-sm text-center">
                  No annotations yet
                </p>
                <p className="text-xs text-center text-ctp-overlay0/70">
                  Highlight text in a document to create annotations
                </p>
              </div>
            )}

            {/* initial state */}
            {!isBuilding && hasAnnotations && !hasQuery && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-ctp-overlay0 px-4">
                <Search className="h-8 w-8" />
                <p className="text-sm text-ctp-text text-center">
                  Search across {entries.length} annotations in {totalDocuments} document{totalDocuments !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-center text-ctp-text">
                  Type to search by annotation text or translation
                </p>
              </div>
            )}

            {/* no results */}
            {!isBuilding && hasAnnotations && hasQuery && results.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-ctp-overlay0 px-4">
                <SearchX className="h-8 w-8" />
                <p className="text-sm text-center">
                  No annotations match &ldquo;{query}&rdquo;
                </p>
                <p className="text-xs text-center text-ctp-overlay0/70">
                  Try a different search term
                </p>
              </div>
            )}

            {/* results list */}
            {!isBuilding && results.length > 0 && (
              <ScrollArea className="flex-1">
                <div ref={listRef} className="divide-y divide-ctp-overlay0/10">
                  {results.map((r, idx) => (
                    <div
                      key={r.item.id}
                      data-search-selected={idx === selectedIndex ? "true" : undefined}
                    >
                      <SearchResultItem
                        entry={r.item}
                        matches={r.matches}
                        isSelected={idx === selectedIndex}
                        onJumpTo={() => handleJumpTo(r.item)}
                        onViewCard={() => handleViewCard(r.item)}
                      />
                    </div>
                  ))}
                </div>
                {/* Result count */}
                <div className="px-3 py-2 text-xs text-ctp-overlay0 border-t border-ctp-overlay0/10">
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* ── Detail card ── */}
          {selectedEntry && (
            <AnnotationSearchCard
              entry={selectedEntry}
              isWide={isWide}
            />
          )}
        </div>

        {/* ── Keyboard hints ── */}
        <div className="shrink-0 flex items-center gap-4 px-4 py-1.5 border-t border-ctp-overlay0/20 text-[10px] text-ctp-text">
          <span><kbd className="px-1 py-0.5 rounded bg-ctp-surface0 text-ctp-text border border-ctp-overlay0/30">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 rounded bg-ctp-surface0 text-ctp-text border border-ctp-overlay0/30">Enter</kbd> Jump to</span>
          <span><kbd className="px-1 py-0.5 rounded bg-ctp-surface0 text-ctp-text border border-ctp-overlay0/30">Esc</kbd> Close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
