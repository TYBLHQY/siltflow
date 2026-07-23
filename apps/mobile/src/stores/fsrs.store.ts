/**
 * FSRS store — mirroring desktop `stores/fsrs.store.ts`.
 *
 * Pure FSRS computation logic via ts-fsrs (re-exported from shared-lib).
 * Uses getSQLite() for card persistence via the service layer.
 *
 * Desktop uses vault config JSON for FSRS parameters; mobile will use
 * AsyncStorage (see settings.store.ts).
 */

import { create } from "zustand";
import type { Card, Grade, RecordLog } from "ts-fsrs";
import { createEmptyCard, generatorParameters, fsrs } from "ts-fsrs";
import { getSQLite } from "@/stores/db.store";
import {
  getFSRSCard,
  saveFSRSCard,
} from "@/services/fsrs-cards.service";
import { saveReviewLog } from "@/services/review-logs.service";

// ── Default FSRS parameters ──────────────────────────────────────────

export interface FSRSParams {
  request_retention: number;
  maximum_interval: number;
  w: number[];
  learning_steps: number[];
  theme: string;
}

const DEFAULT_PARAMS: FSRSParams = {
  request_retention: 0.9,
  maximum_interval: 365,
  w: [
    1.14, 1.01, 5.44, 14.67, 5.3, 1.89, 1.05, 0.04, 1.65, 0.07, 0.86, 0.19,
    0.29, 1.72, 0.55, 1.1, 1.29, 1.19, 1.73,
  ],
  learning_steps: [1, 10],
  theme: "light",
};

// ── Internal FSRS engine instance ─────────────────────────────────────

function createEngine(params: FSRSParams) {
  return fsrs(
    generatorParameters({
      request_retention: params.request_retention,
      maximum_interval: params.maximum_interval,
      w: params.w,
    }),
  );
}

// ── Store ────────────────────────────────────────────────────────────

interface FSRSState {
  params: FSRSParams;
  setParams: (params: Partial<FSRSParams>) => void;
}

export const useFSRSStore = create<FSRSState>((set) => ({
  params: DEFAULT_PARAMS,
  setParams: (patch) =>
    set((s) => ({ params: { ...s.params, ...patch } })),
}));

// ── Review actions (pure computation + persistence) ──────────────────

/**
 * Initialize an FSRS card for an annotation that hasn't been reviewed yet.
 * Returns the new Card (state = New).
 */
export function initAnnotationCard(): Card {
  return createEmptyCard(new Date());
}

/**
 * Review a card (grade 1-4) and persist the updated card + review log.
 *
 * Returns { card, log } or null on error.
 */
export function reviewAnnotation(
  annotationId: string,
  documentId: string,
  grade: Grade,
  existingCard?: Card | null,
): { card: Card; log: RecordLog } | null {
  try {
    const params = useFSRSStore.getState().params;
    const engine = createEngine(params);

    // Load existing card from DB, or create a new one
    let card: Card;
    if (existingCard) {
      card = existingCard;
    } else {
      const db = getSQLite();
      const rawCard = getFSRSCard(db, annotationId, documentId);
      if (rawCard) {
        card = JSON.parse(rawCard) as Card;
      } else {
        card = createEmptyCard(new Date());
      }
    }

    // Run FSRS algorithm
    const scheduledCards = engine.next(card, new Date(), grade);
    // `next()` returns a RecordLog-like object with `card` and `log`.
    // ts-fsrs types it as RecordLog, but the runtime object has { card, log }.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = scheduledCards as any;
    const updatedCard: Card = result.card;

    // Persist updated card
    const db = getSQLite();
    saveFSRSCard(db, annotationId, documentId, updatedCard);

    // Persist review log
    saveReviewLog(db, annotationId, documentId, {
      grade,
      log: result.log,
      card: result.card,
    });

    return {
      card: updatedCard,
      log: result as RecordLog,
    };
  } catch (err) {
    console.error("[fsrs.store] reviewAnnotation failed:", err);
    return null;
  }
}
