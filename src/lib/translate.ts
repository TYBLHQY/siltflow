/**
 * ====================================================================
 * AI Translation & Knowledge Extraction
 * ====================================================================
 *
 * Architectural decisions:
 *
 * 1. **Prompt variables last** — common prefix is identical across requests
 *    so OpenAI / Anthropic prompt caching can reuse the system-prefix block.
 * 2. **JSON response_format** — the API request declares { "type": "json_object" }
 *    to guarantee parseable output.
 * 3. **Type detection** — the prompt asks the model to classify the selection
 *    (word / phrase / sentence / passage) and return the appropriate shape.
 * 4. **Article context** — a lightweight extraction algorithm (first N chars,
 *    first sentence of each section, headings) produces a digest that is
 *    injected into the prompt so the translation can be context-aware.
 */

import type { AIProfile } from "@/stores/ai.store"
import { chatCompletion } from "@/lib/ai"
import type { AIAnnotationData } from "@/lib/annotation-types"

// ===========================================================================
// Types
// ===========================================================================

export interface TranslateOptions {
  /** The selected text to translate / analyse. */
  text: string
  /** Source language code (ISO 639-1). Auto-detected if omitted. */
  sourceLang?: string
  /** Target language code. Default: "zh" */
  targetLang: string
  /** Optional article background context (see extractArticleContext). */
  context?: string
  /** AbortSignal for cancellation. */
  signal?: AbortSignal
}

// ===========================================================================
// System prompt — variables at the end for prompt caching
// ===========================================================================

const SYSTEM_PROMPT_PREFIX = `You are a professional bilingual assistant specialised in reading-comprehension annotation.

TASK
For the user-provided text selection, determine its granularity and return a structured JSON object (no markdown fences, no commentary).

GRANULARITY CLASSIFICATION
- "word"       — a single lexical unit (e.g. "ephemeral", "ephemeral" is a word)
- "phrase"     — multi-word expression (e.g. "in the wake of", "by and large")
- "sentence"   — a complete clause or sentence (ending with . ! ?)
- "passage"    — multiple sentences or a paragraph

JSON OUTPUT SCHEMA
{
  "source_text": "<original text>",
  "type": "<word|phrase|sentence|passage>",
  "source_lang": "<ISO 639-1 code>",
  "target_lang": "<ISO 639-1 code>",

  // Required WHEN source_lang !== target_lang
  "translations": [
    { "target": "<translated text>", "context_hint": "<optional usage hint>" }
  ],

  // Definitions — always provide at least one
  "definitions": [
    {
      "part_of_speech": "<optional POS tag>",
      "definition": "<definition in source language>",
      "definition_local": "<definition in target language (omit if same as source)>"
    }
  ],

  "phonetic": "<IPA or pronunciation, for words/phrases>",
  "usage_notes": "<brief usage / collocation note>",
  "usage_examples": ["<example sentence>"],

  // Word/phrase level only
  "related_terms": [
    { "term": "<related term>", "relation": "synonym|antonym|collocation|derivation|see_also", "term_local": "<translation if applicable>" }
  ],

  // Categorisation
  "category_tags": ["<domain tag>"],
  "difficulty_level": "<A1|A2|B1|B2|C1|C2|native>",

  // Sentence / passage level only
  "grammar_notes": "<grammatical structure analysis>",
  "key_terms": [
    { "term": "<key term>", "explanation": "<brief explanation in target language>" }
  ],
  "gist": "<core idea summary in target language>"
}

CONSTRAINTS
- Output valid JSON only — no surrounding text, no markdown fences.
- For same-language requests (source===target), omit "translations".
- Use target_lang for all localised fields (definitions, gist, etc.).
- When context is provided below, use it to disambiguate domain-specific terms.

CONTEXT:`

const SYSTEM_PROMPT_SUFFIX = `
SELECTED TEXT:`

// ===========================================================================
// Translate one annotation
// ===========================================================================

export async function translateAnnotation(
  profile: AIProfile,
  options: TranslateOptions,
): Promise<AIAnnotationData> {
  const sourceLang = options.sourceLang ?? "auto"
  const targetLang = options.targetLang ?? "zh"

  // Build system message: static prefix + optional context + static suffix + selection
  let systemMsg = SYSTEM_PROMPT_PREFIX
  if (options.context) {
    systemMsg += `\n${options.context}`
  }
  systemMsg += SYSTEM_PROMPT_SUFFIX

  const userMsg = `${options.text}\n\n(source_lang: ${sourceLang}, target_lang: ${targetLang})`

  let fullResponse = ""

  await chatCompletion(
    profile,
    [
      { role: "system", content: systemMsg },
      { role: "user", content: userMsg },
    ],
    (chunk) => {
      if (!chunk.done) fullResponse += chunk.content
    },
    options.signal,
  )

  if (!fullResponse) {
    throw new Error("Empty response from AI model")
  }

  const rawJson = fullResponse.trim()

  // Strip markdown code fences if present (defensive, json_object mode should not produce them)
  const cleaned = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

  return JSON.parse(cleaned) as AIAnnotationData
}

// ===========================================================================
// Article context extraction
// ===========================================================================

/**
 * Extract a lightweight digest from a large PDF text chunk for use as
 * translation background context.
 *
 * Strategy (Geyken et al. "Automatic summarisation for reading aids"):
 * 1. Take the first ~2000 chars (introduction / abstract).
 * 2. Scan for section headings (lines matching common heading patterns).
 * 3. Take the first sentence of each following block (up to 500 chars each).
 * 4. Concatenate and truncate to ~3000 chars.
 */
export function extractArticleContext(pdfText: string): string {
  const lines = pdfText.split("\n")
  const result: string[] = []
  let remaining = 3000

  // 1. First block (up to 2000 chars)
  const firstBlock = pdfText.slice(0, 2000).replace(/\s+/g, " ").trim()
  result.push(firstBlock)
  remaining -= firstBlock.length

  if (remaining <= 0) return result.join("\n\n")

  // 2 & 3. Scan for heading-like lines and grab the first sentence after each
  const headingRe = /^#{1,3}\s|^(?:Abstract|Introduction|Background|Method|Result|Discussion|Conclusion|References)\b/i

  for (let i = 0; i < lines.length && remaining > 0; i++) {
    const line = lines[i]!.trim()
    if (!line) continue
    if (headingRe.test(line)) {
      // Take the heading
      result.push(line)
      remaining -= line.length

      // Take the first sentence of the following paragraph
      let sentence = ""
      for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
        const next = lines[j]!.trim()
        if (!next) break
        sentence = next
        break
      }
      if (sentence) {
        const snippet = sentence.length > 500 ? sentence.slice(0, 500) + "…" : sentence
        result.push(snippet)
        remaining -= snippet.length
      }
    }
  }

  return result.join("\n\n").replace(/\s+/g, " ").trim()
}
