/**
 * Canonical FSRS utilities — constants, formatters, and helpers.
 *
 * All UI components and libs that need FSRS state/grade labels, date formatting,
 * or card stubs should import from here instead of defining their own copies.
 */
import { createEmptyCard } from "ts-fsrs";
import type { Card } from "ts-fsrs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed shape of a review_log.data JSON column. */
export interface ReviewLogData {
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
}

// ---------------------------------------------------------------------------
// FSRS State constants
// ---------------------------------------------------------------------------

/** Human-readable labels for FSRS card states. */
export const STATE_LABEL: Record<number, string> = {
  0: "New",
  1: "Learning",
  2: "Review",
  3: "Relearning",
};

/** Text color CSS classes for FSRS card states. */
export const STATE_TEXT_COLOR: Record<number, string> = {
  0: "text-ctp-sky",
  1: "text-ctp-yellow",
  2: "text-ctp-green",
  3: "text-ctp-red",
};

/** Background + text CSS classes for FSRS card state badges. */
export const STATE_BG: Record<number, string> = {
  0: "bg-ctp-sky/15 text-ctp-sky",
  1: "bg-ctp-yellow/15 text-ctp-yellow",
  2: "bg-ctp-green/15 text-ctp-green",
  3: "bg-ctp-red/15 text-ctp-red",
};

// ---------------------------------------------------------------------------
// FSRS Grade constants
// ---------------------------------------------------------------------------

/** Human-readable labels for FSRS review grades. */
export const GRADE_LABEL: Record<number, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

/** Chart CSS custom-property colors for each grade (keyed by grade number). */
export const GRADE_COLOR: Record<number, string> = {
  1: "var(--catppuccin-color-red)",
  2: "var(--catppuccin-color-peach)",
  3: "var(--catppuccin-color-green)",
  4: "var(--catppuccin-color-blue)",
};

/** Text-only CSS class colors for each grade. */
export const GRADE_TEXT_COLOR: Record<number, string> = {
  1: "text-ctp-red",
  2: "text-ctp-peach",
  3: "text-ctp-green",
  4: "text-ctp-blue",
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Coerce a `Date | string` (common from JSON-deserialised ts-fsrs Cards) to a
 *  proper `Date`. Returns an invalid Date when input is bogus — callers should
 *  guard with `isNaN(d.getTime())` when the source is untrusted. */
export function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

/** Convenience wrapper — equivalent to `toDate(card.due)`. */
export function cardDueDate(card: Card): Date {
  return toDate(card.due);
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/** Human-readable "due today / due tomorrow / 3d overdue / due in 5d" string. */
export function formatDue(due: Date | string): string {
  const d = toDate(due);
  if (isNaN(d.getTime())) return "unknown";
  const diffMs = d.getTime() - Date.now();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "due today";
  if (diffDays === 1) return "due tomorrow";
  return `due in ${diffDays}d`;
}

/** Locale-formatted short date-time, or null when input is missing/invalid. */
export function formatDate(d: Date | string | undefined): string | null {
  if (!d) return null;
  const date = toDate(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Human-readable stability: "<1d → minutes, <30d → 1-decimal days,
 *  <365d → integer days, else years". */
export function formatStability(s: number): string {
  if (s < 1) return `${(s * 1440).toFixed(0)}m`;
  if (s < 30) return `${s.toFixed(1)}d`;
  if (s < 365) return `${Math.round(s)}d`;
  return `${(s / 365).toFixed(1)}y`;
}

/** Human-readable interval: "<1d → minutes, <30d → integer days,
 *  <365d → months, else years". */
export function formatInterval(days: number): string {
  if (days < 1) return `${Math.round(days * 1440)}m`;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${(days / 30).toFixed(1)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

// ---------------------------------------------------------------------------
// Card factory
// ---------------------------------------------------------------------------

/**
 * Create a stub Card representing an annotation that hasn't been reviewed yet.
 * Used when computing per-document metrics or statistics where unreviewed
 * annotations need a placeholder card (state = New).
 *
 * Wraps ts-fsrs `createEmptyCard` so callers don't need to import ts-fsrs
 * just for this one-liner.
 */
export function createNewCardStub(): Card {
  return createEmptyCard(new Date());
}

// ---------------------------------------------------------------------------
// Retrievability
// ---------------------------------------------------------------------------

/**
 * Compute retrievability from FSRS card state.
 * Default w[20] = 0.1542 (FSRS-5) — a reasonable approximation.
 */
export function retrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0 || elapsedDays < 0) return 0;
  const w20 = 0.1542;
  const factor = Math.pow(0.9, -1 / w20) - 1;
  return Math.pow(1 + (factor * elapsedDays) / stability, -w20);
}

// ---------------------------------------------------------------------------
// Retrievability → urgency label
// ---------------------------------------------------------------------------

/**
 * Convert average retrievability (0–1) to a human-readable urgency tag.
 *
 * Thresholds align with `computeDocMetrics`'s retrievability bands:
 * - >=90% -> fresh / well-maintained memory
 * - >=75% -> ok / acceptable recall
 * - >=50% -> due / needs review soon
 * - <50%  -> overdue / significant forgetting
 */
export function retrievabilityLabel(r: number): string {
  if (r >= 90) return "fresh";
  if (r >= 75) return "ok";
  if (r >= 50) return "due";
  return "overdue";
}

// ---------------------------------------------------------------------------
// Review-log parsing
// ---------------------------------------------------------------------------

/** Parse a review_log row's `data` JSON column. Returns null on malformed input. */
export function parseReviewLogData(raw: string): ReviewLogData | null {
  try {
    return JSON.parse(raw) as ReviewLogData;
  } catch {
    return null;
  }
}
