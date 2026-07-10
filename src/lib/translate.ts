/**
 * ====================================================================
 * AI Translation & Knowledge Extraction
 * ====================================================================
 *
 * Prompt and schema designed based on commercial-grade tools
 * (Migaku, Readlang, LingQ, DeepL, Wiktextract).
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
  /** The sentence from the document that contains this text. */
  contextSentence?: string
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
// System prompt
// ===========================================================================

function buildTranslatePrompt(
  sourceLang: string,
  targetLang: string,
  _contextSentence?: string,
): string {
  const isSameLanguage = sourceLang === targetLang

  const BASE_SCHEMA = `{
  "translation": "<natural translation>",
  "source_lang": "<ISO 639-1>",
  "target_lang": "<ISO 639-1>",
  "cleaned_input": "<normalized user text>",
  "lemma": "<base/dictionary form>",
  "pos": "<part-of-speech tag>",
  "definitions": [
    { "pos": "<pos>", "definition": "<explanation in source language>", "gloss": "<explanation in target language>" }
  ],
  "examples": [
    { "sentence": "<example sentence>", "translation": "<translation>", "source": "context|dictionary" }
  ],
  "collocations": [
    { "phrase": "<common collocation>", "translation": "<translation>" }
  ],
  "alternatives": [
    { "expression": "<synonym or alternative phrasing>", "register": "formal|casual|neutral" }
  ],
  "pronunciation": { "ipa": "<IPA transcription>" },
  "metadata": {
    "difficulty": "<A1|A2|B1|B2|C1|C2|native>",
    "register": "<formal|casual|neutral|academic|literary>",
    "tags": ["<domain tag>"]
  },
  "context_sentence": "<context sentence if provided, else omit>"
}`

  if (isSameLanguage) {
    return `You are a professional lexicographer. Explain the given word or phrase in ${targetLang}, providing definitions, usage examples, synonyms, and collocations.

Output ONLY valid JSON — no surrounding text, no markdown fences, no commentary.
Schema:
${BASE_SCHEMA}

CONSTRAINTS:
- 'lemma': base/dictionary form. For "ran" → "run"; for "better" → "good".
- 'definitions': at least 1 entry, max 5 for multi-sense words.
- 'examples': at least 1 entry; if a context sentence is provided, include it as the first example with source "context" and highlight the word with **word**.
- All string fields (translation, definitions, examples, collocations, alternatives) must be plain text only — NO markdown formatting (no bold, italics, lists, headings, code fences, or any other markup). Plain sentences only.
- 'collocations': max 4 entries.
- 'alternatives': max 3 entries, each differing in register.
- 'pronunciation': include IPA for words/phrases; omit for sentences/passages.
- 'metadata.difficulty': estimate CEFR level.
- 'metadata.register': indicate formality level.
- 'metadata.tags': max 3 domain tags.
- POS tags: v, n, adj, adv, pron, prep, conj, interj, art, num, det.
- Use ISO 639-1 language codes.
- cleaned_input: normalize whitespace, remove artifacts.
Source language: ${sourceLang}. Target language: ${targetLang}.`
  } else {
    return `You are a professional bilingual lexicographer. Given a text selection and optional article context, provide translation and lexical analysis.

Output ONLY valid JSON — no surrounding text, no markdown fences, no commentary.
Schema:
${BASE_SCHEMA}

CONSTRAINTS:
- 'lemma': base/dictionary form. For "ran" → "run"; for "better" → "good".
- 'definitions': at least 1 entry, max 5 for multi-sense words.
- 'examples': at least 1 entry; if a context sentence is provided, include it as the first example with source "context" and highlight the word with **word**.
- All string fields (translation, definitions, examples, collocations, alternatives) must be plain text only — NO markdown formatting (no bold, italics, lists, headings, code fences, or any other markup). Plain sentences only.
- 'collocations': max 4 entries.
- 'alternatives': max 3 entries, each differing in register.
- 'pronunciation': include IPA for words/phrases; omit for sentences/passages.
- 'metadata.difficulty': estimate CEFR level.
- 'metadata.register': indicate formality level.
- 'metadata.tags': max 3 domain tags.
- POS tags: v, n, adj, adv, pron, prep, conj, interj, art, num, det.
- Use ISO 639-1 language codes.
- cleaned_input: normalize whitespace, remove artifacts.
Source language: ${sourceLang}. Target language: ${targetLang}.`
  }
}

// ===========================================================================
// Translate one annotation
// ===========================================================================

export async function translateAnnotation(
  profile: AIProfile,
  options: TranslateOptions,
): Promise<AIAnnotationData> {
  const sourceLang = options.sourceLang ?? "auto"
  const targetLang = options.targetLang ?? "zh"

  let systemContent = buildTranslatePrompt(sourceLang, targetLang, options.contextSentence)

  // Append article context to system prompt for disambiguation
  if (options.context) {
    systemContent += `\n\nCONTEXT (article excerpt for disambiguation):\n${options.context}`
  }

  // Build user message: text + context sentence hint
  let userContent = options.text
  if (options.contextSentence) {
    userContent += `\n\nCONTEXT SENTENCE:\n${options.contextSentence}`
  }

  let fullResponse = ""

  await chatCompletion(
    profile,
    [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
    (chunk) => {
      fullResponse += chunk.content
    },
    options.signal,
  )

  if (!fullResponse) {
    throw new Error("Empty response from AI model")
  }

  console.log("[translate] raw response length:", fullResponse.length, "preview:", fullResponse.slice(0, 200))

  const rawJson = fullResponse.trim()
  const cleaned = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

  return JSON.parse(cleaned) as AIAnnotationData
}

// ===========================================================================
// Article context extraction
// ===========================================================================

/**
 * Extract a lightweight digest from a large PDF text chunk for use as
 * translation background context.
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
      result.push(line)
      remaining -= line.length

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
