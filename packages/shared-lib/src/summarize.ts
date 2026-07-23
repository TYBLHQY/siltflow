/**
 * ====================================================================
 * AI Document Summarization — User-selectable pages, single-shot
 * ====================================================================
 */

import type { AIProfile } from "./types/ai";
import { chatCompletion } from "./ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SummaryResult {
  summary: string;
  sourceLang: string;
}

// ---------------------------------------------------------------------------
// Summary prompt
// ---------------------------------------------------------------------------

const SUMMARY_PROMPT = `You are a professional document summarizer for language learners.

Output valid JSON only — no markdown fences, no commentary.
Schema:
{
  "summary": "<concise summary from a learner's perspective, highlighting core arguments and key information>",
  "source_lang": "<BCP 47 language code of the document e.g. en-US, zh-CN>"
}

CONSTRAINTS:
- summary: 3-5 sentences, focus on main arguments.
- source_lang: detect the document's primary language (BCP 47).

EXCERPTS:`;

// ---------------------------------------------------------------------------
// One-shot summarization
// ---------------------------------------------------------------------------

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
  await chatCompletion(
    profile,
    messages,
    (c) => {
      raw += c.content;
    },
    signal,
  );
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary ?? cleaned,
      sourceLang: parsed.source_lang ?? "en-US",
    };
  } catch {
    return { summary: cleaned, sourceLang: "en-US" };
  }
}
