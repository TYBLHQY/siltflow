/**
 * ====================================================================
 * Annotation Type System — AI-powered translation & analysis
 * ====================================================================
 */

export interface DefinitionEntry {
  pos?: string;
  definition: string;
  gloss?: string;
}

export interface ExampleEntry {
  sentence: string;
  translation: string;
}

export interface CollocationEntry {
  phrase: string;
  translation: string;
}

export interface AlternativeEntry {
  expression: string;
  register?: string;
}

export interface PronunciationInfo {
  ipa?: string;
}

export interface AITranslateMetadata {
  difficulty?: string;
  register?: string;
  tags?: string[];
}

export interface AIAnnotationData {
  translation: string;
  source_lang: string;
  target_lang: string;
  cleaned_input: string;

  lemma?: string;
  pos?: string;

  definitions: DefinitionEntry[];
  examples: ExampleEntry[];
  collocations: CollocationEntry[];
  alternatives: AlternativeEntry[];

  pronunciation?: PronunciationInfo;
  metadata?: AITranslateMetadata;

  // ── Backward compat ──
  translate?: string;
  words?: Array<{ word: string; pos?: string; meaning: string }>;
  frequently?: Array<{ phrase: string; translation: string }>;
  usage_examples?: string[];
  difficulty_level?: string;
  category_tags?: string[];
  phonetic?: string;
  granularity?: string;
  usage_notes?: string;
  grammar_notes?: string;
  gist?: string;
  key_terms?: Array<{ term: string; explanation: string }>;
  related_terms?: Array<{
    term: string;
    relation: string;
    term_local?: string;
  }>;
}
