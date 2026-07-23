import type { Card } from "ts-fsrs";
import { ReviewHistorySection } from "@/components/document/ReviewHistorySection";
import { useReviewLogStore } from "@/stores/review-log.store";
import {
  STATE_LABEL,
  STATE_TEXT_COLOR,
  toDate,
  formatDue,
  formatDate,
  formatStability,
} from "@/lib/fsrs-utils";

export function FSRSStats({ card, annotationId, documentId }: { card: Card; annotationId?: string; documentId?: string }) {
  const state = card.state as 0 | 1 | 2 | 3;
  const canShowHistory = !!annotationId && !!documentId;
  const activeHistoryId = useReviewLogStore((s) => s.activeHistoryId);
  const setActiveHistoryId = useReviewLogStore((s) => s.setActiveHistoryId);
  const historyExpanded = activeHistoryId === annotationId;

  const handleToggle = (e: React.MouseEvent) => {
    if (!canShowHistory) return;
    e.stopPropagation();
    setActiveHistoryId(historyExpanded ? null : annotationId!);
  };

  return (
    <>
      <div
        className="flex flex-col gap-1 text-xs text-ctp-overlay0/80 mt-1.5 border-t border-ctp-overlay0/15 pt-1.5"
        onClick={handleToggle}
      >
        {/* Row 1: state / reps / lapses */}
        <div className="flex items-center gap-x-3">
          <span className={`font-medium ${STATE_TEXT_COLOR[state] ?? ""}`}>
            {STATE_LABEL[state] ?? "Unknown"}
          </span>
          <span>
            reps: <b className="text-ctp-text/80">{card.reps}</b>
          </span>
          <span>
            lapses: <b className="text-ctp-text/80">{card.lapses}</b>
          </span>
        </div>
        {/* Row 2: stability / difficulty */}
        <div className="flex items-center gap-x-3">
          <span>
            stability:{" "}
            <b className="text-ctp-text/80">
              {formatStability(card.stability)}
            </b>
          </span>
          <span>
            difficulty:{" "}
            <b className="text-ctp-text/80">{card.difficulty.toFixed(2)}</b>
          </span>
        </div>
        {/* Row 3: due / last review */}
        <div className="flex items-center gap-x-3">
          <span
            className={
              toDate(card.due) <= new Date()
                ? "text-ctp-red/80 font-medium"
                : ""
            }
          >
            {formatDue(card.due)}
          </span>
          {formatDate(card.last_review) && (
            <span className="text-ctp-overlay0/80">
              last: {formatDate(card.last_review)}
            </span>
          )}
          {/* Collapse hint indicator */}
          {canShowHistory && (
            <span className="ml-auto text-ctp-overlay0/40 select-none">
              {historyExpanded ? "▾" : "▸"}
            </span>
          )}
        </div>
      </div>
      {/* Animated expand/collapse */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{
          gridTemplateRows: historyExpanded && canShowHistory ? "1fr" : "0fr",
        }}
      >
        <div className="overflow-hidden">
          {canShowHistory && (
            <ReviewHistorySection
              annotationId={annotationId!}
              documentId={documentId!}
            />
          )}
        </div>
      </div>
    </>
  );
}
