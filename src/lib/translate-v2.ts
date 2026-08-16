/**
 * ====================================================================
 * V2 AI Translation — Two-stage pipeline
 *
 * 1. input AI: normalize text, detect source_lang, infer type
 *    — SKIPPED for phrase/sentence with a concrete source-language hint:
 *      every field is derivable in code, so the record is built locally
 *    (only word-lemma and unknown-language input need the AI round-trip)
 * 2. output AI: generate type-specific analysis (word/phrase/sentence)
 *
 * Static-first prompt design for Prompt Caching Optimization.
 * ====================================================================
 */

import type { AIProfile } from "@/types/ai";
import { chatCompletion } from "@/lib/ai";
import { inferGranularity } from "@/lib/granularity";
import type {
  AIAnnotationDataV2,
  AIAnnotationInputV2,
  AIAnnotationOutputV2,
} from "@/types/annotation";

// ===========================================================================
// Constants
// ===========================================================================

/** Maximum context length in characters for the output AI prompt. */
const MAX_CONTEXT_LENGTH = 5000;

/** Truncate a context block to MAX_CONTEXT_LENGTH with an ellipsis suffix. */
function truncateContext(s: string): string {
  return s.length > MAX_CONTEXT_LENGTH
    ? `${s.slice(0, MAX_CONTEXT_LENGTH)}…`
    : s;
}

// ===========================================================================
// Input AI
// ===========================================================================

const INPUT_SYSTEM_PROMPT = `You are a text normalization assistant. Analyze the given text and produce a clean input record.

Output ONLY valid JSON — no surrounding text, no markdown fences, no commentary.

Schema:
{
  "text": "<original text>",
  "normalized": "<normalized version — trim whitespace, normalize to NFC unicode>",
  "source_lang": "<BCP 47 language code — use the provided hint; only override with extreme caution (see CONSTRAINTS); if truly unsure output 'und'>",
  "type": "<word|phrase|sentence — use the provided hint but verify>",
  "lemma": "<base/dictionary form — for word type only; null for phrase/sentence>"
}

CONSTRAINTS:
- source_lang: use the provided hint. Only override it when there is overwhelming
  multi-word evidence the hint is wrong (e.g. a full sentence clearly in a different
  language), never from etymology alone.
  Individual words and short phrases frequently appear across languages
  (e.g. English has ~30% French-origin vocabulary like "haute", "rendezvous").
  When the hint says "en-US" and the text is a single word or short phrase,
  trust the hint — borrowed words are the norm, not an exception.
- type: verify the provided hint:
  * "word" = single word (including contractions like "don't", "it's")
  * "phrase" = multi-word expression that does NOT contain a subject-predicate pair
  * "sentence" = expression with a subject and predicate, typically ending with punctuation (.!?)
- lemma: provide only when type is "word":
  * Strip inflections to the canonical dictionary form.
  * Examples: "ran" → "run", "better" → "good", "mice" → "mouse", "was" → "be".
  * For multi-word phrases/sentences, set lemma to null.
  * When the word is already in its base form, repeat it.
- normalized: remove extra whitespace, normalize NFC unicode, preserve case`;

function buildInputUserMessage(
  text: string,
  sourceLangHint: string,
  targetLang: string,
  typeHint: string,
): string {
  let msg = `Text: ${text}`;
  msg += `\nSource language hint: ${sourceLangHint}`;
  msg += `\nTarget language: ${targetLang}`;
  msg += `\nType hint: ${typeHint}`;
  return msg;
}

async function callInputAI(
  profile: AIProfile,
  text: string,
  sourceLangHint: string,
  targetLang: string,
  typeHint: string,
  signal?: AbortSignal,
): Promise<AIAnnotationInputV2> {
  const userContent = buildInputUserMessage(
    text,
    sourceLangHint,
    targetLang,
    typeHint,
  );

  let raw = "";
  await chatCompletion(
    profile,
    [
      { role: "system", content: INPUT_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    (chunk) => {
      raw += chunk.content;
    },
    signal,
  );

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as AIAnnotationInputV2;

  // Validate type — fallback to program's hint if AI returns unexpected value
  if (!["word", "phrase", "sentence"].includes(parsed.type)) {
    parsed.type = typeHint as AIAnnotationInputV2["type"];
  }

  return parsed;
}

// ===========================================================================
// Output AI — type-specific prompts
// ===========================================================================

/**
 * Static system prompt preamble shared across all V2 output types.
 * No variables — fully cacheable.
 */
const OUTPUT_SYSTEM_PREAMBLE = `You are a bilingual lexicographer providing translation and language analysis. Given the input record, document context, and a type-specific schema, produce the requested output.

Output ONLY valid JSON — no surrounding text, no markdown fences, no commentary.

RULES (apply to ALL types):
- All text fields must be plain text only — NO markdown formatting (no bold, italics, lists, headings, code fences, or any other markup).
- Use ONLY Universal Dependencies POS tags: NOUN, VERB, ADJ, ADV, PRON, DET, ADP, AUX, CONJ, SCONJ, PART, NUM, PROPN, INTJ. Do NOT use any other tag set (e.g., no Penn Treebank tags like NN, VB, JJ).
- CEFR levels: A1, A2, B1, B2, C1, C2.
- Lists must have 1-5 items. Prioritize quality over quantity — 2 excellent results are better than 5 mediocre ones. For words with many senses, select the most frequent and context-relevant ones.
- Translations must be natural and idiomatic in the target language.
- For idioms and culturally specific expressions, provide the closest natural equivalent rather than a literal translation.
- Maintain the original register in translations (formal ↔ formal, casual ↔ casual).`;

/**
 * Per-type JSON schemas appended to the static preamble.
 * These are also static (no variables) — the input data follows in the user message.
 */

const WORD_SCHEMA = `Schema:
{
  "meanings": [
    {"pos": "<UD POS tag>", "translation": "<translation for this sense>"}
  ],
  "definitions": [
    {
      "pos": "<UD POS tag>",
      "definition": {"source": "<definition in source language>", "target": "<translation of the definition>"}
    }
  ],
  "examples": [
    {"sentence": "<example sentence using the word in this sense>", "translation": "<translation of the example>"}
  ],
  "collocations": [
    {"phrase": "<common collocation using the word>", "translation": "<translation>"}
  ],
  "synonyms": ["<synonym1>", "<synonym2>"],
  "cefr": "<A1|A2|B1|B2|C1|C2>"
}

INSTRUCTIONS for meanings:
- The word may have multiple distinct senses (一词多义). Cover ALL major senses, prioritizing the most relevant to the provided CONTEXT.
- Group senses by part of speech — return separate entries for each distinct sense, even under the same POS.
- Stay within the 1-5 item limit: prioritize the most frequent / context-relevant senses.
- Example: for "run" → meanings could include {pos:"VERB", translation:"奔跑"} and {pos:"VERB", translation:"运营"} and {pos:"NOUN", translation:"跑步"} — covering major verb and noun senses.

INSTRUCTIONS for synonyms:
- synonyms: 1-5 items. Each synonym must be a SINGLE WORD, not a phrase or compound expression.
- Do NOT include phrasal verbs (e.g. "carry out"), compound expressions (e.g. "in spite of"), or any multi-word entries.
- Collocations are handled separately — synonyms must NOT overlap with collocations.

RELATIONSHIP between meanings and definitions:
- "meanings" are CONCISE glosses in the target language (1-5 words each). They serve as quick look-up translations.
- "definitions" are FULL dictionary-style explanations, first in the source language then translated.
- Each definition SHOULD correspond to a meaning entry for the same sense — but with expanded detail.
- Do NOT copy-paste the same text between meanings and definitions.`;

const PHRASE_SCHEMA = `Schema:
{
  "translation": "<natural translation of the entire phrase>",
  "examples": [
    {"sentence": "<example sentence using the phrase>", "translation": "<translation>"}
  ]
}`;

const SENTENCE_SCHEMA = `Schema:
{
  "translation": "<natural translation of the entire sentence>"
}`;

function getTypeSchema(type: AIAnnotationInputV2["type"]): string {
  switch (type) {
    case "word":
      return WORD_SCHEMA;
    case "phrase":
      return PHRASE_SCHEMA;
    case "sentence":
      return SENTENCE_SCHEMA;
  }
}

/**
 * Build the output-stage user message.
 *
 * Order matters for prompt caching: the auto document `documentContext` (stable
 * per document) and the target-language line form the shared prefix across
 * cards, while the user-authored `userContext` (card-local, same cache weight
 * as the card text) sits immediately before `Input` in the varying tail.
 */
export function buildOutputUserMessage(
  input: AIAnnotationInputV2,
  targetLang: string,
  documentContext: string | undefined,
  userContext: string | undefined,
): string {
  const inputJson = JSON.stringify(input);
  const lines: string[] = [];
  if (documentContext) {
    lines.push(
      `CONTEXT (document excerpt for disambiguation, max ${MAX_CONTEXT_LENGTH} chars):\n${truncateContext(documentContext)}`,
    );
  }
  lines.push(`IMPORTANT: All translations must be in ${targetLang}.`);
  if (userContext) {
    lines.push(
      `USER CONTEXT (user-authored note for disambiguation, max ${MAX_CONTEXT_LENGTH} chars):\n${truncateContext(userContext)}`,
    );
  }
  lines.push(`Input: ${inputJson}`);
  return lines.join("\n");
}

// ===========================================================================
// Output AI dispatcher
// ===========================================================================

async function callOutputAI(
  profile: AIProfile,
  input: AIAnnotationInputV2,
  targetLang: string,
  documentContext: string | undefined,
  userContext: string | undefined,
  signal?: AbortSignal,
): Promise<AIAnnotationOutputV2> {
  const typeSchema = getTypeSchema(input.type);

  // system = [static preamble] + [static type schema] (both fully cacheable)
  const systemContent = `${OUTPUT_SYSTEM_PREAMBLE}\n\n${typeSchema}`;
  const userContent = buildOutputUserMessage(
    input,
    targetLang,
    documentContext,
    userContext,
  );

  let raw = "";
  await chatCompletion(
    profile,
    [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
    (chunk) => {
      raw += chunk.content;
    },
    signal,
  );

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned) as AIAnnotationOutputV2;
}

// ===========================================================================
// Public API
// ===========================================================================

/**
 * Build the input record programmatically — no AI round-trip — for phrase and
 * sentence selections with a concrete source-language hint. Every field is
 * derivable in code: `normalized` is a plain string op (trim + collapse
 * whitespace + NFC), `type` comes from `inferGranularity`, and `lemma` is null
 * for non-words. Only the word path (lemma = inflection → base form) and
 * unknown-language input ("und") need the input AI.
 */
function buildInputRecord(
  text: string,
  sourceLangHint: string,
  typeHint: AIAnnotationInputV2["type"],
): AIAnnotationInputV2 {
  return {
    text,
    normalized: text.trim().replace(/\s+/g, " ").normalize("NFC"),
    source_lang: sourceLangHint,
    type: typeHint,
    lemma: null,
  };
}

export interface TranslateV2Options {
  /** Profile for the input AI stage (normalization, language detection). */
  inputProfile: AIProfile;
  /** Profile for the output AI stage (semantic analysis, translations). */
  outputProfile: AIProfile;
  /** The selected text to translate / analyse. */
  text: string;
  /** Source language hint from user config (BCP 47). */
  sourceLang?: string;
  /** Target language for translation (BCP 47). */
  targetLang: string;
  /** Document summary / article context for disambiguation. */
  documentContext?: string;
  /** User-authored per-card context note — injected ONLY in the output stage,
   *  in the card-local tail (same prompt-cache weight as the card text). */
  userContext?: string;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

/**
 * Main V2 translation pipeline.
 *
 * 1. Program infers a type hint from the text.
 * 2. Input record — via the input AI for words (lemma) or unknown-language
 *    input; built in code for phrase/sentence with a known language hint.
 * 3. output AI produces type-specific analysis.
 *
 * Returns the full AIAnnotationDataV2 result.
 */
export async function translateAnnotationV2(
  options: TranslateV2Options,
): Promise<AIAnnotationDataV2> {
  const sourceLangHint = options.sourceLang ?? "und";
  const targetLang = options.targetLang ?? "zh-CN";

  // Step 1: Program infers type
  // inferGranularity returns "word"|"phrase"|"sentence"
  const typeHint = inferGranularity(options.text);

  // Step 2: Input record — from the input AI (word-lemma and unknown-language
  // input need a linguistic round-trip) or built in code when it adds nothing.
  const needsInputAI = typeHint === "word" || sourceLangHint === "und";
  const input = needsInputAI
    ? await callInputAI(
        options.inputProfile,
        options.text,
        sourceLangHint,
        targetLang,
        typeHint,
        options.signal,
      )
    : buildInputRecord(options.text, sourceLangHint, typeHint);

  // Step 3: Output AI (using outputProfile)
  const output = await callOutputAI(
    options.outputProfile,
    input,
    targetLang,
    options.documentContext,
    options.userContext,
    options.signal,
  );

  // Step 4: Assemble result
  // The `documentContext` echo keeps the AUTO document context (backward
  // compatible); the user-authored note lives on the annotation row, not in
  // the blob.
  return {
    input,
    documentContext: options.documentContext
      ? truncateContext(options.documentContext)
      : null,
    output,
  };
}
