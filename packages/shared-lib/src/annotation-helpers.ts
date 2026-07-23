/**
 * Shared helpers for AI annotation data rendering.
 * Used by both AITranslateCard (annotations tab) and StudyPanel
 * (learning modal).
 *
 * NOTE: earlier versions of this file carried backward-compat fallbacks
 * for fields like `translate`, `words`, `frequently`, etc.  Those were
 * intermediate-development artifacts with no real user data depending
 * on them, so they've been removed entirely.  All AI annotation data
 * is assumed to follow the current AIAnnotationData schema.
 */

import type { AIAnnotationDataV1 } from "./types/annotation";

type AIResult = AIAnnotationDataV1;

// ── Translation ─────────────────────────────────────────────────────

export function getTranslation(ai: AIResult): string | undefined {
  return ai.translation;
}

// ── Definitions ─────────────────────────────────────────────────────

export function getDefinitions(ai: AIResult) {
  if (!ai.definitions) return [];
  return ai.definitions.filter((d) => d.definition || d.gloss);
}

// ── Collocations ────────────────────────────────────────────────────

export function getCollocations(ai: AIResult) {
  return ai.collocations ?? [];
}

// ── Pronunciation ───────────────────────────────────────────────────

export function getIpa(ai: AIResult): string | undefined {
  return ai.pronunciation?.ipa;
}

// ── Difficulty / Register / Metadata ────────────────────────────────

export function getDifficulty(ai: AIResult): string | undefined {
  return ai.metadata?.difficulty;
}

export function getRegister(ai: AIResult): string | undefined {
  return ai.metadata?.register;
}

// ── Alternatives ────────────────────────────────────────────────────

export function getAlternatives(ai: AIResult) {
  return ai.alternatives ?? [];
}

// ── Granularity detection ───────────────────────────────────────────

export function inferGranularity(
  _ai: AIResult,
  text: string,
): string {
  const t = text.trim();
  if (t.includes("\n") || t.split(" ").length > 30) return "sentence";
  if (t.split(/[.!?;]+/).filter(Boolean).length > 1) return "sentence";
  if (t.split(" ").length > 2) return "phrase";
  return "word";
}

// ── Detail availability ─────────────────────────────────────────────

export function hasDetails(ai: AIResult): boolean {
  const coll = getCollocations(ai);
  const alts = getAlternatives(ai);
  const defs = getDefinitions(ai);
  const exs = ai.examples;
  const register = getRegister(ai);
  if (coll.length > 0) return true;
  if (alts.length > 0) return true;
  if (exs && exs.length > 0) return true;
  if (register) return true;
  if (defs.length > 1) return true;
  return false;
}
