import { Button } from "@/components/ui/button";
import { Loader2, BrainCircuit, FileText } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, memo, useEffect } from "react";
import type { DocReviewMetrics, SortField } from "@/lib/doc-review";
import { retrievabilityLabel } from "@/lib/fsrs-utils";
import { useDocumentStore } from "@/stores/document.store";

interface ReviewTabProps {
  docMetrics: DocReviewMetrics[];
  metricsLoading: boolean;
  sortedMetrics: DocReviewMetrics[];
  /** When non-empty, scroll to this doc (used when switching to review tab) */
  scrollToDocId?: string;
  /** Called after scroll-to completes */
  onScrolledToDoc?: () => void;
  sortField: SortField;
  onSortChange: (f: SortField) => void;
}

// ── Row component ──────────────────────────────────────────────────────

const ReviewTabRow = memo(function ReviewTabRow({
  metric,
  isActive,
}: {
  metric: DocReviewMetrics;
  isActive: boolean;
}) {
  const setCurrentDocument = useDocumentStore((s) => s.setCurrentDocument);
  const hasTags = metric.totalCards > 0;
  return (
    <div
      data-doc-id={metric.documentId}
      className={`group relative border-b border-ctp-overlay0/50 pl-3 text-sm transition-colors cursor-pointer ${
        isActive
          ? "before:absolute before:left-0 before:top-0 before:h-full before:w-1.5 before:bg-ctp-yellow"
          : "hover:bg-ctp-surface0"
      } ${hasTags ? "py-2.5 pr-3" : "py-2 pr-3"}`}
      onClick={() => setCurrentDocument({ id: metric.documentId, title: metric.documentTitle })}
    >
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="h-4 w-4 shrink-0 text-ctp-overlay0" />
        <span
          className="truncate min-w-0 flex-1 select-none"
          title={metric.documentTitle}
        >
          {metric.documentTitle}
        </span>
      </div>
      {hasTags && (
        <div className="flex flex-wrap items-center gap-1 mt-0.5">
          <span className="rounded bg-ctp-blue/10 px-1 py-0.5 font-medium text-ctp-blue">
            {metric.newCardsCount} new
          </span>
          <span className="rounded bg-ctp-red/10 px-1 py-0.5 font-medium text-ctp-red">
            {metric.dueNowCount} due
          </span>
          <span className="rounded bg-ctp-peach/10 px-1 py-0.5 font-medium text-ctp-peach">
            {metric.dueSoonCount} soon
          </span>
          <span className="rounded bg-ctp-mauve/15 px-1 py-0.5 font-medium text-ctp-mauve">
            {retrievabilityLabel(metric.avgRetrievability)}
          </span>
        </div>
      )}
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────

export const ReviewTab = memo(function ReviewTab({
  docMetrics,
  metricsLoading,
  sortedMetrics,
  scrollToDocId,
  onScrolledToDoc,
  sortField,
  onSortChange,
}: ReviewTabProps) {
  // Virtual scrolling
  const parentRef = useRef<HTMLDivElement>(null);

  const currentDocument = useDocumentStore((s) => s.currentDocument);

  const virtualizer = useVirtualizer({
    count: sortedMetrics.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // fallback; measureElement overrides after first render
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 10,
  });

  // Auto-scroll to the current document when switching to review tab
  useEffect(() => {
    if (!scrollToDocId || sortedMetrics.length === 0) return;
    const idx = sortedMetrics.findIndex(
      (m) => m.documentId === scrollToDocId,
    );
    if (idx >= 0) {
      virtualizer.scrollToIndex(idx, { align: "center" });
    }
    onScrolledToDoc?.();
  }, [scrollToDocId, sortedMetrics, virtualizer, onScrolledToDoc]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <>
      {/* Sort selector */}
      <div className="shrink-0 border-b">
        {docMetrics.length > 0 && (
          <div className="flex items-center gap-0.5 px-2 py-1.5">
            {(["new", "due", "soon", "urgency"] as SortField[]).map((f) => (
              <Button
                key={f}
                variant={sortField === f ? "default" : "ghost"}
                size="xs"
                className="flex-1 h-6 px-1 text-[11px]"
                onClick={() => onSortChange(f)}
              >
                {f === "new"
                  ? "New"
                  : f === "due"
                    ? "Due"
                    : f === "soon"
                      ? "Soon"
                      : "Urgency"}
              </Button>
            ))}
          </div>
        )}
      </div>

      {metricsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-ctp-overlay0" />
        </div>
      ) : sortedMetrics.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-ctp-overlay0 px-4">
          <BrainCircuit className="h-8 w-8 mb-2" />
          <p className="text-xs text-center">No review data yet</p>
          <p className="text-xs text-center">
            Annotate and review cards to see per-document metrics
          </p>
        </div>
      ) : (
        <div
          ref={parentRef}
          className="flex-1 overflow-y-auto"
          style={{ contain: "strict" }}
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
          >
            {virtualItems.map((virtualRow) => {
              const metric = sortedMetrics[virtualRow.index];
              if (!metric) return null;
              return (
                <div
                  key={metric.documentId}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ReviewTabRow
                    metric={metric}
                    isActive={currentDocument?.id === metric.documentId}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
});
