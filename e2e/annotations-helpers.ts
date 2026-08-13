import { expect, type Page } from "@playwright/test";

// ── V2 card fixtures ────────────────────────────────────────────────────────
// Shared by the virtualized-list alignment specs (annotations-alignment,
// annotations-untranslated) so the card heights stay in sync across tests.

/** Compact V2 result — short collapsed card (single meaning). */
export const makeCompact = (word: string) => ({
  input: {
    text: word,
    normalized: word,
    source_lang: "en-US",
    type: "word",
    lemma: word,
  },
  context: null,
  output: {
    meanings: [{ pos: "VERB", translation: "忍受" }],
    definitions: [
      {
        pos: "VERB",
        definition: { source: "to suffer", target: "忍受" },
      },
    ],
    examples: [{ sentence: "She endured.", translation: "她忍受了。" }],
    collocations: [],
    synonyms: [],
    cefr: "B2",
  },
});

/** Rich V2 result — much taller when expanded (more meanings / defs / examples). */
export const makeTall = (word: string) => ({
  input: {
    text: word,
    normalized: word,
    source_lang: "en-US",
    type: "word",
    lemma: word,
  },
  context: null,
  output: {
    meanings: [
      { pos: "VERB", translation: "承受" },
      { pos: "VERB", translation: "支持" },
      { pos: "NOUN", translation: "耐力" },
    ],
    definitions: [
      { pos: "VERB", definition: { source: "to suffer", target: "承受" } },
      { pos: "VERB", definition: { source: "to support", target: "支持" } },
      { pos: "NOUN", definition: { source: "endurance", target: "耐力" } },
      {
        pos: "NOUN",
        definition: { source: "a lasting quality", target: "持久性" },
      },
    ],
    examples: [
      {
        sentence: "She endured the long journey.",
        translation: "她忍受了漫长的旅程。",
      },
      {
        sentence: "The bridge endured the storm.",
        translation: "那座桥承受住了风暴。",
      },
      {
        sentence: "His endurance was remarkable.",
        translation: "他的耐力令人瞩目。",
      },
    ],
    collocations: [
      { words: "endure pain", translation: "忍受痛苦" },
      { words: "endure hardship", translation: "忍受艰难" },
    ],
    synonyms: ["withstand", "bear", "tolerate"],
    cefr: "C1",
  },
});

/**
 * Long source text wraps → the collapsed card is already taller than a
 * single-word card, so every index slot has a distinct resting height.
 */
export const longText = (word: string) =>
  `${word} — ${"A longer phrase with several words. ".repeat(6)}`.trim();

// ── Alignment assertion ────────────────────────────────────────────────────

/**
 * Every rendered card must sit exactly where the previous one ends:
 * overlapping (stale height too small) or gapped (too large) are both
 * misalignment. Poll so a legitimate async settle doesn't flake, but a
 * regression is *persistent* (it only heals on scroll) so the poll fails.
 */
export async function expectCardsAligned(window: Page) {
  await expect
    .poll(
      async () => {
        const cards = window.locator("[data-annotation-id]");
        const count = await cards.count();
        if (count < 2) return true;
        const boxes = await Promise.all(
          Array.from({ length: count }, (_, i) => cards.nth(i).boundingBox()),
        );
        const rects: Array<{ y: number; height: number }> = [];
        for (const b of boxes) {
          if (!b) return false;
          rects.push({ y: b.y, height: b.height });
        }
        rects.sort((a, b) => a.y - b.y);
        for (let i = 1; i < rects.length; i++) {
          const gap = rects[i].y - (rects[i - 1].y + rects[i - 1].height);
          if (Math.abs(gap) > 2) return false;
        }
        return true;
      },
      {
        timeout: 5_000,
        message:
          "annotations cards misaligned (overlap or gap after add/delete + expand/collapse)",
      },
    )
    .toBe(true);
}
