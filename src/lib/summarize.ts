/**
 * ====================================================================
 * AI Document Summarization — User-selectable pages, single-shot
 * ====================================================================
 *
 * Instead of map-reduce (which costs too many tokens), we extract
 * per-page text and let the user pick which pages to summarise.
 * Only the selected pages are concatenated and sent to the AI in
 * one shot — cheap and fast.
 */

import type { AIProfile } from "@/stores/ai.store"
import { chatCompletion } from "@/lib/ai"
import type { PDFDocumentProxy } from "pdfjs-dist"

// ---------------------------------------------------------------------------
// PDF text extraction — per-page
// ---------------------------------------------------------------------------

/**
 * Extract text from every page of a PDF, returning an array indexed by
 * page number (1-based).
 */
export async function extractPageTexts(pdfDoc: PDFDocumentProxy): Promise<string[]> {
  const numPages = pdfDoc.numPages
  const texts: string[] = []

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i)
    const tc = await page.getTextContent()
    const text = tc.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
    texts.push(text)
  }

  return texts
}

// ---------------------------------------------------------------------------
// One-shot summarization of user-selected pages
// ---------------------------------------------------------------------------

const SUMMARY_PROMPT = `You are a professional document summarizer.

Below are excerpts from a document.  Produce a concise summary capturing the key information, main arguments, and important details.

Output valid JSON only — no markdown fences, no commentary:
{ "summary": "<your summary here>" }

EXCERPTS:`

/**
 * Summarize the selected pages of a PDF in a single API call.
 *
 * @param profile      - AI provider profile
 * @param pageTexts    - full per-page text array (indexed 0-based)
 * @param selectedPageNumbers - 1-based page numbers to include
 * @param signal       - optional AbortSignal
 * @returns The summary string.
 */
export async function summarizeSelectedPages(
  profile: AIProfile,
  pageTexts: string[],
  selectedPageNumbers: number[],
  signal?: AbortSignal,
): Promise<string> {
  // Concatenate selected pages
  const parts = selectedPageNumbers
    .filter((p) => p >= 1 && p <= pageTexts.length)
    .map((p) => `[Page ${p}]\n${pageTexts[p - 1]!}`)

  if (parts.length === 0) {
    throw new Error("No pages selected")
  }

  const input = parts.join("\n\n")

  const messages = [
    { role: "system" as const, content: SUMMARY_PROMPT },
    { role: "user" as const, content: input },
  ]

  let raw = ""
  await chatCompletion(profile, messages, (c) => { raw += c.content }, signal)
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

  try {
    const parsed = JSON.parse(cleaned)
    return parsed.summary ?? cleaned
  } catch {
    return cleaned
  }
}
