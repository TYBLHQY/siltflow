/**
 * ====================================================================
 * Annotation Type System — AI-powered translation & analysis
 * ====================================================================
 *
 * Schema designed based on commercial-grade tools (Migaku, Readlang,
 * LingQ, DeepL, Wiktextract) for reading-comprehension annotation.
 *
 * Key design principles:
 * - translation, definitions, examples 三者分离清晰
 * - lemma 支持屈折还原
 * - 多义项独立条目
 * - context_sentence 保存原文上下文
 * - metadata 结构化（CEFR, register, tags）
 */

// ---------------------------------------------------------------------------
// Example sentence
// ---------------------------------------------------------------------------
export interface ExampleEntry {
  sentence: string;
  translation: string;
}

// ---------------------------------------------------------------------------
// Collocation / frequent pattern
// ---------------------------------------------------------------------------
export interface CollocationEntry {
  phrase: string;
  translation: string;
}

// ---------------------------------------------------------------------------
// Alternative expression (synonym / rephrase)
// ---------------------------------------------------------------------------
export interface AlternativeEntry {
  expression: string;
  register?: string;
}

// ---------------------------------------------------------------------------
// Pronunciation
// ---------------------------------------------------------------------------
export interface PronunciationInfo {
  ipa?: string;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------
export interface AITranslateMetadata {
  difficulty?: string; // CEFR: A1-C2 / native
  register?: string; // formal | casual | neutral | academic | literary
  tags?: string[]; // domain tags
}

// ===========================================================================
// V2 types — word / phrase / sentence
// ===========================================================================

// ── V2 Input (common) ─────────────────────────────────────────────────────

export interface AIAnnotationInputV2 {
  /** Original user-selected text. */
  text: string;
  /** Normalized version (whitespace, unicode NFC). */
  normalized: string;
  /** BCP 47 language code (verified by input AI). */
  source_lang: string;
  /** Content type, validated by input AI. */
  type: "word" | "phrase" | "sentence";
  /** Base/dictionary form. For "ran" → "run"; for "better" → "good". null for phrases/sentences. */
  lemma?: string | null;
}

// ── V2 Output: word ────────────────────────────────────────────────────────

export interface WordMeaning {
  /** UD POS tag: NOUN, VERB, ADV, ADJ, PRON, etc. */
  pos: string;
  /** Translation of this sense in target language. */
  translation: string;
}

export interface WordDefinitionEntry {
  /** UD POS tag. */
  pos: string;
  /** Definition in source language + its translation. */
  definition: {
    /** Explanation in the source language. */
    source: string;
    /** Translation of the explanation in target language. */
    target: string;
  };
}

export interface WordExample {
  /** Example sentence in source language. */
  sentence: string;
  /** Translation of the example. */
  translation: string;
}

export interface WordCollocation {
  /** Common collocation / usage pattern. */
  phrase: string;
  /** Translation of the collocation. */
  translation: string;
}

export interface WordOutputV2 {
  /** Senses ordered by frequency (most common first). 1-5 items. */
  meanings: WordMeaning[];
  /** Detailed definitions. 1-5 items. */
  definitions: WordDefinitionEntry[];
  /** Usage examples. 1-5 items. */
  examples: WordExample[];
  /** Common collocations. 1-5 items. */
  collocations: WordCollocation[];
  /** Synonyms (source language only, no translation). 1-5 items. */
  synonyms: string[];
  /** CEFR level: A1, A2, B1, B2, C1, C2. */
  cefr: string;
}

// ── V2 Output: phrase ──────────────────────────────────────────────────────

export interface PhraseOutputV2 {
  /** Natural translation of the entire phrase. */
  translation: string;
  /** Usage examples. 1-5 items. */
  examples: WordExample[];
}

// ── V2 Output: sentence ────────────────────────────────────────────────────

export interface SentenceOutputV2 {
  /** Natural translation of the entire sentence. */
  translation: string;
}

// ── Combined V2 output ─────────────────────────────────────────────────────

export type AIAnnotationOutputV2 =
  WordOutputV2 | PhraseOutputV2 | SentenceOutputV2;

// ── V2 full result ─────────────────────────────────────────────────────────

export interface AIAnnotationDataV2 {
  /** Input fields (produced by input AI). */
  input: AIAnnotationInputV2;
  /** Document context (up to 5000 chars). */
  documentContext: string | null;
  /** Type-specific output (produced by output AI). */
  output: AIAnnotationOutputV2;
}
