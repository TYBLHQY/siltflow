import { Search, Loader2, BrainCircuit, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DocReviewMetrics } from "@/lib/doc-review";

interface ReviewTabProps {
  docMetrics: DocReviewMetrics[];
  metricsLoading: boolean;
  reviewSearch: string;
  setReviewSearch: (v: string) => void;
  filteredMetrics: DocReviewMetrics[];
  documents: { id: string; title: string }[];
  currentDocument: { id: string; title: string } | null;
  onSelectDocument: (doc: { id: string; title: string }) => void;
  reviewScrollRef: React.Ref<HTMLDivElement>;
  reviewSearchRef: React.Ref<HTMLInputElement>;
}

function urgencyLabel(avgRetrievability: number): string {
  if (avgRetrievability >= 0.9) return "fresh";
  if (avgRetrievability >= 0.8) return "ok";
  if (avgRetrievability >= 0.7) return "due";
  return "overdue";
}

export function ReviewTab({
  docMetrics,
  metricsLoading,
  reviewSearch,
  setReviewSearch,
  filteredMetrics,
  documents,
  currentDocument,
  onSelectDocument,
  reviewScrollRef,
  reviewSearchRef,
}: ReviewTabProps) {
  return (
    <>
      {/* Search filter bar */}
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
                    ? "before:absolute before:left-0 before:top-0 before:h-full before:w-1.5 before:bg-yellow-500"
                    : "hover:bg-accent"
                }`}
                onClick={() => {
                  const doc = documents.find((d) => d.id === m.documentId);
                  if (doc) onSelectDocument(doc);
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
    </>
  );
}
