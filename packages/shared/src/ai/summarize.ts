/**
 * ====================================================================
 * AI Document Summarization — Shared across platforms
 * ====================================================================
 */

import type { AIProfile } from "../types/ai-profile.js";
import { chatCompletion } from "./client.js";

export interface SummaryResult {
  summary: string;
  sourceLang: string;
  keyVocabulary: { term: string; cefr?: string }[];
  gist: string;
}

const SUMMARY_PROMPT = `You are a professional document summarizer for language learners.

Output valid JSON only — no markdown fences, no commentary.
Schema:
{
  "summary": "<concise summary from a learner's perspective>",
  "source_lang": "<ISO 639-1 language code>",
  "key_vocabulary": [
    { "term": "<important vocabulary item>", "cefr": "<A1|A2|B1|B2|C1|C2>" }
  ],
  "gist": "<one-sentence core idea>"
}

CONSTRAINTS:
- summary: 3-5 sentences, focus on main arguments.
- source_lang: detect the document's primary language.
- key_vocabulary: extract 3-8 important or challenging words.
- gist: one sentence capturing the single most important idea.

EXCERPTS:`;

export async function summarizeSelectedPages(
  profile: AIProfile,
  pageTexts: string[],
  selectedPageNumbers: number[],
  signal?: AbortSignal,
): Promise<SummaryResult> {
  const parts = selectedPageNumbers
    .filter((p) => p >= 1 && p <= pageTexts.length)
    .map((p) => `[Page ${p}]\n${pageTexts[p - 1]!}`);

  if (parts.length === 0) {
    throw new Error("No pages selected");
  }

  const input = parts.join("\n\n");

  const messages = [
    { role: "system" as const, content: SUMMARY_PROMPT },
    { role: "user" as const, content: input },
  ];

  let raw = "";
  await chatCompletion(profile, messages, (c) => {
    raw += c.content;
  }, signal);

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary ?? cleaned,
      sourceLang: parsed.source_lang ?? "en",
      keyVocabulary: Array.isArray(parsed.key_vocabulary)
        ? parsed.key_vocabulary
        : [],
      gist: parsed.gist ?? "",
    };
  } catch {
    return { summary: cleaned, sourceLang: "en", keyVocabulary: [], gist: "" };
  }
}
