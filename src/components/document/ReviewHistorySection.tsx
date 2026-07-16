import { useEffect, useState } from "react";
import { useReviewLogStore, type ReviewLogEntry } from "@/stores/review-log.store";

// ── Grade labels & colors ────────────────────────────────────────────────

const GRADE_INFO: Record<number, { label: string; color: string }> = {
  1: { label: "Again", color: "text-ctp-red" },
  2: { label: "Hard", color: "text-orange" },
  3: { label: "Good", color: "text-ctp-green" },
  4: { label: "Easy", color: "text-ctp-blue" },
};

const STATE_LABELS: Record<number, string> = {
  0: "New",
  1: "Learning",
  2: "Review",
  3: "Relearning",
};

const STATE_BG: Record<number, string> = {
  0: "bg-sky/15 text-ctp-sky",
  1: "bg-yellow/15 text-ctp-yellow",
  2: "bg-green/15 text-ctp-green",
  3: "bg-red/15 text-ctp-red",
};

// ── Helpers ──────────────────────────────────────────────────────────────

function parseEntryData(entry: ReviewLogEntry) {
  try {
    return JSON.parse(entry.data) as {
      grade: number;
      log: {
        rating: number;
        state: number;
        due: string;
        stability: number;
        difficulty: number;
        scheduled_days: number;
        learning_steps: number;
        review: string;
      };
      card: {
        due: string;
        stability: number;
        difficulty: number;
        scheduled_days: number;
        learning_steps: number;
        reps: number;
        lapses: number;
        state: number;
      };
    };
  } catch {
    return null;
  }
}

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

function formatInterval(days: number): string {
  if (days < 1) return `${Math.round(days * 1440)}m`;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${(days / 30).toFixed(1)}mo`;
  return `${(days / 365).toFixed(1)}y`;
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
        const parsed = parseEntryData(entry);
        if (!parsed) return null;
        const { grade, log, card } = parsed;
        const gInfo = GRADE_INFO[grade] ?? { label: "?", color: "text-muted" };

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
            <span className={`shrink-0 font-semibold ${gInfo.color}`}>
              {gInfo.label}
            </span>

            {/* State transition */}
            <span
              className={`inline-flex items-center rounded px-1 py-0.5 leading-none ${
                STATE_BG[log.state] ?? "text-muted"
              }`}
            >
              {STATE_LABELS[log.state] ?? "?"}
            </span>

            {/* Arrow */}
            <span className="text-ctp-overlay0/40 shrink-0">→</span>

            {/* New state */}
            <span
              className={`inline-flex items-center rounded px-1 py-0.5 leading-none ${
                STATE_BG[card.state] ?? "text-muted"
              }`}
            >
              {STATE_LABELS[card.state] ?? "?"}
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
