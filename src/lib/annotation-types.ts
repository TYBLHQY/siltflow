/**
 * ====================================================================
 * Annotation Type System — AI-powered translation & analysis
 * ====================================================================
 *
 * The AI classifies selected text into one of four granularities:
 *   word     — single lexical unit (e.g. "ephemeral")
 *   phrase   — multi-word expression  (e.g. "in the wake of")
 *   sentence — complete clause/sentence
 *   passage  — paragraph or longer block
 *
 * For each type the AI returns a structured JSON payload that drives
 * the rendering of the AnnotationCard in the right panel.
 */

// ---------------------------------------------------------------------------
// Granularity
// ---------------------------------------------------------------------------
/** AI-detected text granularity. */
export type AnnotationGranularity = "word" | "phrase" | "sentence" | "passage"

// ---------------------------------------------------------------------------
// AI result — translation variant
// ---------------------------------------------------------------------------
export interface TranslationVariant {
  /** The translated text. */
  target: string
  /** When this variant is preferred (e.g. "formal", "colloquial", "in biology"). */
  context_hint?: string
}

// ---------------------------------------------------------------------------
// AI result — definition / gloss
// ---------------------------------------------------------------------------
export interface DefinitionEntry {
  part_of_speech?: string
  /** Definition in the source language (e.g. English → English). */
  definition?: string
  /** Definition localised into the target language (e.g. English → Chinese). */
  definition_local?: string
}

// ---------------------------------------------------------------------------
// AI result — related term
// ---------------------------------------------------------------------------
export interface RelatedTerm {
  term: string
  relation: "synonym" | "antonym" | "collocation" | "derivation" | "see_also"
  /** Translation of this related term. */
  term_local?: string
}

// ---------------------------------------------------------------------------
// Full AI annotation payload
// ---------------------------------------------------------------------------
export interface AIAnnotationData {
  /** The original selected text. */
  source_text: string

  /** AI-inferred granularity. */
  type: AnnotationGranularity

  /** Source language code (ISO 639-1, e.g. "en", "zh", "fr"). */
  source_lang: string
  /** Target language code.  Same as source_lang for self-translate. */
  target_lang: string

  // ── Translations (absent for same-language "explain" mode) ─────────
  translations?: TranslationVariant[]

  // ── Definitions (always present) ──────────────────────────────────
  definitions?: DefinitionEntry[]

  // ── Pronunciation (useful for words/phrases) ──────────────────────
  phonetic?: string

  // ── Usage & examples ──────────────────────────────────────────────
  usage_notes?: string
  usage_examples?: string[]

  // ── Word-links (for words & phrases) ──────────────────────────────
  related_terms?: RelatedTerm[]

  // ── Categorisation (for knowledge structuring) ────────────────────
  /** Subject / domain tags. */
  category_tags?: string[]
  /** Estimated difficulty (CEFR: A1–C2, or "native"). */
  difficulty_level?: string

  // ── Sentence / passage level ──────────────────────────────────────
  /** Grammatical / structural analysis (sentence-level). */
  grammar_notes?: string
  /** In-passage key term explanations. */
  key_terms?: Array<{ term: string; explanation: string }>
  /** Core idea summary (passage-level). */
  gist?: string
}
