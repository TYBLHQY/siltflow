import { useState } from "react";
import type { Card } from "ts-fsrs";
import { ReviewHistorySection } from "@/components/document/ReviewHistorySection";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Coerce Date | string → Date (ts-fsrs Card dates arrive as ISO strings via JSON) */
function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

const STATE_LABELS: Record<number, string> = {
  0: "New",
  1: "Learning",
  2: "Review",
  3: "Relearning",
};

const STATE_COLORS: Record<number, string> = {
  0: "text-sky",
  1: "text-yellow",
  2: "text-green",
  3: "text-red",
};

function formatDue(due: Date | string): string {
  const d = toDate(due);
  if (isNaN(d.getTime())) return "unknown";
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "due today";
  if (diffDays === 1) return "due tomorrow";
  return `due in ${diffDays}d`;
}

function formatDate(d: Date | string | undefined): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStability(s: number): string {
  if (s < 1) return `${(s * 1440).toFixed(0)}m`;
  if (s < 30) return `${s.toFixed(1)}d`;
  if (s < 365) return `${Math.round(s)}d`;
  return `${(s / 365).toFixed(1)}y`;
}

// ── Component ────────────────────────────────────────────────────────────

interface FSRSStatsProps {
  card: Card;
  annotationId?: string;
  documentId?: string;
}

export function FSRSStats({ card, annotationId, documentId }: FSRSStatsProps) {
  const state = card.state as 0 | 1 | 2 | 3;
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const canShowHistory = !!annotationId && !!documentId;

  return (
    <>
      <div
        className="flex flex-col gap-1 text-xs text-muted-foreground mt-1 border-t border-border/20 pt-1"
        onClick={(e) => {
          if (!canShowHistory) return;
          e.stopPropagation();
          setHistoryExpanded((v) => !v);
        }}
      >
        {/* Row 1: state / reps / lapses */}
        <div className="flex items-center gap-x-3">
          <span className={`font-medium ${STATE_COLORS[state] ?? ""}`}>
            {STATE_LABELS[state] ?? "Unknown"}
          </span>
          <span>reps: <b className="text-foreground/80">{card.reps}</b></span>
          <span>lapses: <b className="text-foreground/80">{card.lapses}</b></span>
        </div>
        {/* Row 2: stability / difficulty */}
        <div className="flex items-center gap-x-3">
          <span>stability: <b className="text-foreground/80">{formatStability(card.stability)}</b></span>
          <span>difficulty: <b className="text-foreground/80">{card.difficulty.toFixed(2)}</b></span>
        </div>
        {/* Row 3: due / last review */}
        <div className="flex items-center gap-x-3">
          <span className={toDate(card.due) <= new Date() ? "text-red/80 font-medium" : ""}>
            {formatDue(card.due)}
          </span>
          {formatDate(card.last_review) && (
            <span className="text-muted-foreground/50">
              last: {formatDate(card.last_review)}
            </span>
          )}
          {/* Collapse hint indicator */}
          {canShowHistory && (
            <span className="ml-auto text-muted-foreground/40 select-none">
              {historyExpanded ? "▾" : "▸"}
            </span>
          )}
        </div>
      </div>
      {historyExpanded && canShowHistory && (
        <ReviewHistorySection annotationId={annotationId!} documentId={documentId!} />
      )}
    </>
  );
}
