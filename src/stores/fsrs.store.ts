import { create } from "zustand";
import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  type FSRSParameters,
  type Card,
  type Grade,
  type ReviewLog,
} from "ts-fsrs";
import { useAnnotationStore } from "./annotation.store";
import { useReviewLogStore } from "./review-log.store";
import type { ReviewLogSaveRequest } from "@/types/review";

const VAULT_KEY = "fsrsParams";

// ---------------------------------------------------------------------------
// Default parameters — reasonable for vocabulary review
// ---------------------------------------------------------------------------
const DEFAULT_PARAMS: FSRSParameters = generatorParameters({
  request_retention: 0.85,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ["1m", "10m"] as const,
  relearning_steps: ["10m"] as const,
});

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
interface FSRSStoreState {
  /** Whether initial load from vault is done */
  loaded: boolean;
  /** FSRS parameters (user-tunable) */
  params: FSRSParameters;
  updateParam: <K extends keyof FSRSParameters>(
    key: K,
    value: FSRSParameters[K],
  ) => void;
  resetParams: () => void;
}

export const useFSRSStore = create<FSRSStoreState>()((set) => ({
  loaded: false,
  params: { ...DEFAULT_PARAMS },

  updateParam: (key, value) =>
    set((s) => {
      const next = { ...s.params, [key]: value };
      persistToVault(next);
      return { params: next };
    }),

  resetParams: () => {
    persistToVault(DEFAULT_PARAMS);
    set({ params: { ...DEFAULT_PARAMS } });
  },
}));

// ---------------------------------------------------------------------------
// Vault persistence
// ---------------------------------------------------------------------------
function persistToVault(params: FSRSParameters) {
  void window.siltflow.vaultConfigSet({ [VAULT_KEY]: params });
}

export async function loadFSRSParams(cfg?: Record<string, unknown>) {
  try {
    cfg ??= await window.siltflow.vaultConfigGet();
    const saved = cfg[VAULT_KEY] as Partial<FSRSParameters> | undefined;
    if (saved) {
      useFSRSStore.setState({
        params: { ...DEFAULT_PARAMS, ...saved },
        loaded: true,
      });
      return;
    }
  } catch {
    /* ignore */
  }
  useFSRSStore.setState({ loaded: true });
}

// ---------------------------------------------------------------------------
// FSRS helpers
// ---------------------------------------------------------------------------

/** Get a configured FSRS engine from store's current params. */
export function getFSRSEngine() {
  const params = useFSRSStore.getState().params;
  return fsrs(params);
}

/** Create a new FSRS card for an annotation (first review).
 *  Note: FSRS cards are created automatically on first review via
 *  reviewAnnotation. This function can be called to pre-init a card.
 */
export function initAnnotationCard(annotationId: string) {
  const card = createEmptyCard(new Date());
  const store = useAnnotationStore.getState();
  store.updateItem(annotationId, { fsrsCard: card });
}

/**
 * Submit a review for an annotation.
 *
 * The card update and its review log are persisted together in a single
 * atomic IPC (`review:record`) so the two tables can never drift apart.
 * The in-memory annotation store is updated with `persist: false` — the DB
 * write is owned by review:record, so a second fsrs_cards write (and the
 * ordering hazard between two independent INSERTs) is avoided entirely.
 *
 * @param annotationId the annotation's id
 * @param grade 1=Again 2=Hard 3=Good 4=Easy
 */
export function reviewAnnotation(annotationId: string, grade: Grade) {
  const store = useAnnotationStore.getState();
  const item = store.items.find((i) => i.id === annotationId);
  if (!item) return;

  const engine = getFSRSEngine();
  const now = new Date();

  // TS infers record.card / record.log from the concrete engine.next(card,
  // now, grade) call — the ts-fsrs overload is generic, so a `ReturnType`
  // annotation would collapse to unknown.
  let record: { card: Card; log: ReviewLog };
  if (item.fsrsCard) {
    // Existing card — repeat and schedule
    const card: Card = {
      ...item.fsrsCard,
      due: new Date(item.fsrsCard.due),
      last_review: item.fsrsCard.last_review
        ? new Date(item.fsrsCard.last_review)
        : undefined,
    };
    record = engine.next(card, now, grade);
  } else {
    // First review — create a card and run repeat
    const card = createEmptyCard(now);
    record = engine.next(card, now, grade);
  }

  // Update in-memory state (no DB write here — review:record owns persistence).
  store.updateItem(annotationId, { fsrsCard: record.card }, { persist: false });

  const logData = serializeReviewLog(grade, record.log, record.card);
  void window.siltflow.review.record({
    annotationId,
    documentId: item.documentId,
    card: record.card,
    log: logData,
  });
  // Optimistically prepend to the in-memory review-log cache. If the IPC write
  // later fails, the entry stays cached until the next reload — acceptable
  // (matches the previous fire-and-forget reviewLogs.save behavior).
  void useReviewLogStore.getState().add(annotationId, item.documentId, logData);
}

/** Serialize a ts-fsrs ReviewLog + Card snapshot to the IPC shape (Dates → ISO). */
function serializeReviewLog(
  grade: Grade,
  log: ReviewLog,
  card: Card,
): ReviewLogSaveRequest {
  return {
    grade,
    log: {
      rating: log.rating,
      state: log.state,
      due: typeof log.due === "string" ? log.due : log.due.toISOString(),
      stability: log.stability,
      difficulty: log.difficulty,
      scheduled_days: log.scheduled_days,
      learning_steps: log.learning_steps,
      review:
        typeof log.review === "string" ? log.review : log.review.toISOString(),
    },
    card: {
      due: typeof card.due === "string" ? card.due : card.due.toISOString(),
      stability: card.stability,
      difficulty: card.difficulty,
      scheduled_days: card.scheduled_days,
      learning_steps: card.learning_steps,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
    },
  };
}

/** Get the next review date for a card, or undefined if never reviewed. */
export function getNextReview(card?: Card): Date | undefined {
  if (!card?.due) return undefined;
  // due may be a Date or an ISO string depending on serialization path
  return card.due instanceof Date ? card.due : new Date(card.due);
}
