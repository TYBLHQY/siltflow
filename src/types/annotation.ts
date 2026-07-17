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
 * - backward compat: 渲染层 fallback 到旧字段
 */

// ---------------------------------------------------------------------------
// Definitions entry
// ---------------------------------------------------------------------------
export interface DefinitionEntry {
  pos?: string;
  /** Explanation in the source language. */
  definition: string;
  /** Explanation in the target language. */
  gloss?: string;
}

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

// ---------------------------------------------------------------------------
// Full AI annotation payload
// ---------------------------------------------------------------------------
export interface AIAnnotationDataV1 {
  /** Natural translation. */
  translation: string;
  /** Source language code (ISO 639-1). */
  source_lang: string;
  /** Target language code. */
  target_lang: string;
  /** Normalized user input. */
  cleaned_input: string;

  /** Base/dictionary form (for inflected words). */
  lemma?: string;
  /** Part-of-speech tag. */
  pos?: string;

  /** Multi-sense definitions. */
  definitions: DefinitionEntry[];
  /** Example sentences. */
  examples: ExampleEntry[];
  /** Common collocations / usage patterns. */
  collocations: CollocationEntry[];
  /** Synonyms / alternative phrasings by register. */
  alternatives: AlternativeEntry[];

  /** Pronunciation information. */
  pronunciation?: PronunciationInfo;

  /** Metadata (CEFR, register, domain tags). */
  metadata?: AITranslateMetadata;

  // ── Backward compat (old fields kept for existing annotations) ──
  /** @deprecated Use translation. */
  translate?: string;
  /** @deprecated Use definitions. */
  words?: Array<{ word: string; pos?: string; meaning: string }>;
  /** @deprecated Use collocations. */
  frequently?: Array<{ phrase: string; translation: string }>;
  /** @deprecated Use examples. */
  usage_examples?: string[];
  /** @deprecated Use metadata.difficulty. */
  difficulty_level?: string;
  /** @deprecated Use metadata.tags. */
  category_tags?: string[];
  /** @deprecated Use pronunciation.ipa. */
  phonetic?: string;
  /** @deprecated Not used in new schema. */
  granularity?: string;
  /** @deprecated Not used in new schema. */
  usage_notes?: string;
  /** @deprecated Not used in new schema. */
  grammar_notes?: string;
  /** @deprecated Not used in new schema. */
  gist?: string;
  /** @deprecated Not used in new schema. */
  key_terms?: Array<{ term: string; explanation: string }>;
  /** @deprecated Not used in new schema. */
  related_terms?: Array<{
    term: string;
    relation: string;
    term_local?: string;
  }>;
}
