import { useEffect, useState } from "react";
import { useReviewLogStore } from "@/stores/review-log.store";
import {
  STATE_LABEL,
  STATE_BG,
  GRADE_TEXT_COLOR,
  GRADE_LABEL,
  formatInterval,
  parseReviewLogData,
} from "@/lib/fsrs-utils";

// ── Helpers ──────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Component ────────────────────────────────────────────────────────────

interface ReviewHistorySectionProps {
  annotationId: string;
  documentId: string;
}

export function ReviewHistorySection({
  annotationId,
  documentId,
}: ReviewHistorySectionProps) {
  const logs = useReviewLogStore((s) => s.logs[annotationId]);
  const load = useReviewLogStore((s) => s.load);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!logs) {
      setLoading(true);
      load(annotationId, documentId).finally(() => setLoading(false));
    }
  }, [annotationId, documentId, load, logs]);

  if (loading) {
    return (
      <div className="text-xs text-ctp-overlay0/50 py-1 text-center">Loading history…</div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-xs text-ctp-overlay0/50 py-1 text-center">No review history yet</div>
    );
  }

  return (
    <div className="text-xs leading-snug space-y-0.5 mt-1">
      {logs.map((entry) => {
        const parsed = parseReviewLogData(entry.data);
        if (!parsed) return null;
        const { grade, log, card } = parsed;
        const gLabel = GRADE_LABEL[grade] ?? "?";
        const gColor = GRADE_TEXT_COLOR[grade] ?? "text-ctp-overlay0";

        return (
          <div
            key={entry.id}
            className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded bg-ctp-surface0/30 px-1.5 py-1"
          >
            {/* Time */}
            <span className="text-ctp-overlay0/60 shrink-0 tabular-nums">
              {formatTime(log.review)}
            </span>

            {/* Grade badge */}
            <span className={`shrink-0 font-semibold ${gColor}`}>
              {gLabel}
            </span>

            {/* State transition */}
            <span
              className={`inline-flex items-center rounded px-1 py-0.5 leading-none ${
                STATE_BG[log.state] ?? "text-ctp-overlay0"
              }`}
            >
              {STATE_LABEL[log.state] ?? "?"}
            </span>

            {/* Arrow */}
            <span className="text-ctp-overlay0/40 shrink-0">→</span>

            {/* New state */}
            <span
              className={`inline-flex items-center rounded px-1 py-0.5 leading-none ${
                STATE_BG[card.state] ?? "text-ctp-overlay0"
              }`}
            >
              {STATE_LABEL[card.state] ?? "?"}
            </span>

            {/* Stability */}
            <span className="text-ctp-maroon/70 shrink-0">
              S:
              <b className="text-ctp-text/80 ml-0.5">
                {log.stability < 30
                  ? log.stability.toFixed(1)
                  : Math.round(log.stability)}
              </b>
            </span>

            {/* Difficulty */}
            <span className="text-ctp-maroon/70 shrink-0">
              D:
              <b className="text-ctp-text/80 ml-0.5">
                {card.difficulty.toFixed(2)}
              </b>
            </span>

            {/* Scheduled interval */}
            {card.scheduled_days > 0 && (
              <span className="text-ctp-overlay0/50 shrink-0 tabular-nums">
                +{formatInterval(card.scheduled_days)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
