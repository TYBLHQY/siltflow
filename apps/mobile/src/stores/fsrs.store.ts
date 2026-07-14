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

const CONFIG_KEY = "fsrs_params";

const DEFAULT_PARAMS: FSRSParameters = generatorParameters({
  request_retention: 0.85,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ["1m", "10m"] as const,
  relearning_steps: ["10m"] as const,
});

interface FSRSStoreState {
  loaded: boolean;
  params: FSRSParameters;
  updateParam: <K extends keyof FSRSParameters>(key: K, value: FSRSParameters[K]) => void;
  resetParams: () => void;
}

async function persistToConfig(params: FSRSParameters) {
  try {
    const { configSet } = await import("../config");
    await configSet(CONFIG_KEY, JSON.stringify(params));
  } catch { /* ignore */ }
}

export const useFSRSStore = create<FSRSStoreState>()((set) => ({
  loaded: false,
  params: { ...DEFAULT_PARAMS },

  updateParam: (key, value) =>
    set((s) => {
      const next = { ...s.params, [key]: value };
      persistToConfig(next);
      return { params: next };
    }),

  resetParams: () => {
    persistToConfig(DEFAULT_PARAMS);
    set({ params: { ...DEFAULT_PARAMS } });
  },
}));

export async function loadFSRSParams() {
  try {
    const { configGetAll } = await import("../config");
    const cfg = await configGetAll();
    const saved = cfg[CONFIG_KEY];
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<FSRSParameters>;
      useFSRSStore.setState({
        params: { ...DEFAULT_PARAMS, ...parsed },
        loaded: true,
      });
      return;
    }
  } catch { /* ignore */ }
  useFSRSStore.setState({ loaded: true });
}

export function getFSRSEngine() {
  const params = useFSRSStore.getState().params;
  return fsrs(params);
}

export function initAnnotationCard(annotationId: string) {
  const card = createEmptyCard(new Date());
  const store = useAnnotationStore.getState();
  store.updateItem(annotationId, { fsrsCard: card });
}

export function reviewAnnotation(annotationId: string, grade: Grade) {
  const store = useAnnotationStore.getState();
  const item = store.items.find((i) => i.id === annotationId);
  if (!item) return;

  const engine = getFSRSEngine();
  const now = new Date();

  if (item.fsrsCard) {
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
    const card = createEmptyCard(now);
    const record = engine.next(card, now, grade);
    store.updateItem(annotationId, { fsrsCard: record.card });
    persistReviewLog(annotationId, item.documentId, grade, record.log, record.card);
  }
}

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

export function getNextReview(card?: Card): Date | undefined {
  if (!card?.due) return undefined;
  return card.due instanceof Date ? card.due : new Date(card.due);
}
