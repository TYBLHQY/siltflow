import { create } from "zustand";
import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  type FSRSParameters,
  type Card,
  type Grade,
} from "ts-fsrs";
import { useAnnotationStore } from "./annotation.store";
import { useReviewLogStore } from "./review-log.store";

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
  window.siltflow.vaultConfigSet({ [VAULT_KEY]: params });
}

export async function loadFSRSParams(cfg?: Record<string, unknown>) {
  try {
    if (!cfg) cfg = await window.siltflow.vaultConfigGet();
    const saved = (cfg as Record<string, unknown>)[VAULT_KEY] as
      Partial<FSRSParameters> | undefined;
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
 * @param annotationId the annotation's id
 * @param grade 1=Again 2=Hard 3=Good 4=Easy
 */
export function reviewAnnotation(annotationId: string, grade: Grade) {
  const store = useAnnotationStore.getState();
  const item = store.items.find((i) => i.id === annotationId);
  if (!item) return;

  const engine = getFSRSEngine();
  const now = new Date();

  if (item.fsrsCard) {
    // Existing card — repeat and schedule
    const card: Card = {
      ...item.fsrsCard,
      due: new Date(item.fsrsCard.due),
      last_review: item.fsrsCard.last_review
        ? new Date(item.fsrsCard.last_review)
        : undefined,
    };
    const record = engine.next(card, now, grade);
    store.updateItem(annotationId, { fsrsCard: record.card });
    persistReviewLog(annotationId, item.documentId, grade, record.log, record.card);
  } else {
    // First review — create a card and run repeat
    const card = createEmptyCard(now);
    const record = engine.next(card, now, grade);
    store.updateItem(annotationId, { fsrsCard: record.card });
    persistReviewLog(annotationId, item.documentId, grade, record.log, record.card);
  }
}

/** Persist a single ReviewLog along with a card snapshot to the review_logs table. */
function persistReviewLog(
  annotationId: string,
  documentId: string,
  grade: Grade,
  log: import("ts-fsrs").ReviewLog,
  card: Card,
) {
  const data = {
    grade,
    log: {
      rating: log.rating,
      state: log.state,
      due: typeof log.due === "string" ? log.due : log.due.toISOString(),
      stability: log.stability,
      difficulty: log.difficulty,
      scheduled_days: log.scheduled_days,
      learning_steps: log.learning_steps,
      review: typeof log.review === "string" ? log.review : log.review.toISOString(),
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
  useReviewLogStore.getState().add(annotationId, documentId, data);
}

/** Get the next review date for a card, or undefined if never reviewed. */
export function getNextReview(card?: Card): Date | undefined {
  if (!card?.due) return undefined;
  // due may be a Date or an ISO string depending on serialization path
  return card.due instanceof Date ? card.due : new Date(card.due);
}
