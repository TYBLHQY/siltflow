import { useEffect, useState } from "react";
import { useReviewLogStore, type ReviewLogEntry } from "@/stores/review-log.store";

// ── Grade labels & colors ────────────────────────────────────────────────

const GRADE_INFO: Record<number, { label: string; color: string }> = {
  1: { label: "Again", color: "text-red" },
  2: { label: "Hard", color: "text-orange" },
  3: { label: "Good", color: "text-green" },
  4: { label: "Easy", color: "text-blue" },
};

const STATE_LABELS: Record<number, string> = {
  0: "New",
  1: "Learning",
  2: "Review",
  3: "Relearning",
};

const STATE_BG: Record<number, string> = {
  0: "bg-sky/15 text-sky",
  1: "bg-yellow/15 text-yellow",
  2: "bg-green/15 text-green",
  3: "bg-red/15 text-red",
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
      <div className="text-[10px] text-muted-foreground/50 py-1 text-center">
        Loading history…
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-[10px] text-muted-foreground/50 py-1 text-center">
        No review history yet
      </div>
    );
  }

  return (
    <div className="text-[10px] leading-tight space-y-0.5 mt-1">
      {logs.map((entry) => {
        const parsed = parseEntryData(entry);
        if (!parsed) return null;
        const { grade, log, card } = parsed;
        const gInfo = GRADE_INFO[grade] ?? { label: "?", color: "text-muted" };

        return (
          <div
            key={entry.id}
            className="flex items-center gap-x-2 rounded bg-muted/30 px-1.5 py-1"
          >
            {/* Time */}
            <span className="text-muted-foreground/60 shrink-0 w-16 tabular-nums">
              {formatTime(log.review)}
            </span>

            {/* Grade badge */}
            <span
              className={`shrink-0 font-semibold ${gInfo.color} w-10 text-center`}
            >
              {gInfo.label}
            </span>

            {/* State transition */}
            <span
              className={`shrink-0 inline-flex items-center rounded px-1 py-0.5 leading-none ${
                STATE_BG[log.state] ?? "text-muted"
              }`}
            >
              {STATE_LABELS[log.state] ?? "?"}
            </span>

            {/* Arrow */}
            <span className="text-muted-foreground/40">→</span>

            {/* New state */}
            <span
              className={`shrink-0 inline-flex items-center rounded px-1 py-0.5 leading-none ${
                STATE_BG[card.state] ?? "text-muted"
              }`}
            >
              {STATE_LABELS[card.state] ?? "?"}
            </span>

            {/* Stability */}
            <span className="text-muted-foreground/70">
              S:
              <b className="text-foreground/80">
                {log.stability < 30
                  ? log.stability.toFixed(1)
                  : Math.round(log.stability)}
              </b>
            </span>

            {/* Difficulty */}
            <span className="text-muted-foreground/70">
              D:
              <b className="text-foreground/80">
                {card.difficulty.toFixed(2)}
              </b>
            </span>

            {/* Scheduled interval */}
            {card.scheduled_days > 0 && (
              <span className="text-muted-foreground/50 ml-auto tabular-nums">
                +{formatInterval(card.scheduled_days)}
              </span>
            )}
          </div>
        );
      })}

      {/* Total count */}
      <div className="text-[9px] text-muted-foreground/40 text-right pr-1">
        {logs.length} review{logs.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
