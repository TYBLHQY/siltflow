import { test, expect } from "@playwright/test";
import {
  launchApp,
  seedDocument,
  seedAIV2Annotation,
  makePosition,
  openDocument,
  waitForPdf,
} from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

// Compact V2 result — short collapsed card (single meaning).
const makeCompact = (word: string) => ({
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

// Rich V2 result — much taller when expanded (more meanings / defs / examples).
const makeTall = (word: string) => ({
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

// Long source text wraps → the collapsed card is already taller than a
// single-word card, so every index slot has a distinct resting height.
const longText = (word: string) =>
  `${word} — ${"A longer phrase with several words. ".repeat(6)}`.trim();

// Regression guard for the virtualized annotations list: the measurement
// cache must be keyed by stable card id (getItemKey), NOT by index. When a
// card is added or deleted every later index shifts; with an index-keyed
// cache the surviving variable-height cards (collapsed vs expanded) get a
// stale height applied and overlap / leave gaps until the next scroll
// re-measures them. Interleave expand/collapse with add/delete across a
// large list — the misalignment must never appear.
test("annotations list stays aligned across interleaved add/delete + expand/collapse", async () => {
  const { app, window } = await launchApp((vault) => {
    const docId = seedDocument(vault, FIXTURE_PDF);
    for (let i = 0; i < 100; i++) {
      const tall = i % 2 === 1;
      seedAIV2Annotation(vault, docId, {
        id: `ann-${i}`,
        pageNumber: 1 + i,
        text: tall ? longText(`w${i}`) : `word ${i}`,
        aiResult: tall ? makeTall(`w${i}`) : makeCompact(`w${i}`),
        position: makePosition(1 + i),
      });
    }
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);
    await window.getByRole("tab", { name: "Annotations" }).click();
    await expect(window.locator('[data-annotation-id="ann-0"]')).toBeVisible();

    // Which cards are currently expanded — only bookkeeping; a click always
    // flips the real card, so the sequence below stays correct.
    const expanded = new Set<string>();
    const toggleCard = async (id: string) => {
      const card = window.locator(`[data-annotation-id="${id}"]`);
      await expect(card).toBeVisible();
      const box = await card.boundingBox();
      if (!box) throw new Error(`card ${id} has no box`);
      // Click the header row's whitespace (granularity label ↔ v2 badge): the
      // source-text span and action-bar buttons stopPropagation, but the
      // header's gaps bubble to the card's expand/collapse toggle.
      await card.click({ position: { x: box.width / 2, y: 20 } });
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      // 200ms grid-template-rows animation + ResizeObserver settle.
      await window.waitForTimeout(350);
    };

    const deleteCard = async (id: string) => {
      const card = window.locator(`[data-annotation-id="${id}"]`);
      await expect(card).toBeVisible();
      await card.locator('button[title="Delete"]').click();
      // Row leaves the DOM, then let the shifted cards settle.
      await expect(card).toBeHidden({ timeout: 5_000 });
      await window.waitForTimeout(300);
      expanded.delete(id);
    };

    const addManualAnnotation = async (text: string) => {
      await window.getByTitle("Add manual annotation").click();
      const dialog = window.getByRole("dialog");
      await dialog.locator("textarea").fill(text);
      await dialog.getByRole("button", { name: "Add" }).click();
      await expect(dialog).toBeHidden({ timeout: 5_000 });
      await window.waitForTimeout(300);
    };

    // Every rendered card must sit exactly where the previous one ends:
    // overlapping (stale height too small) or gapped (too large) are both
    // misalignment. Poll so a legitimate async settle doesn't flake, but the
    // regression is *persistent* (it only heals on scroll) so the poll fails.
    const expectCardsAligned = async () => {
      await expect
        .poll(
          async () => {
            const cards = window.locator("[data-annotation-id]");
            const count = await cards.count();
            if (count < 2) return true;
            const boxes = await Promise.all(
              Array.from({ length: count }, (_, i) =>
                cards.nth(i).boundingBox(),
              ),
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
    };

    // Baseline: the 100-card list must render aligned before any mutation.
    await expectCardsAligned();

    // Interleaved expand/collapse — puts tall (expanded) cards above short ones.
    await toggleCard("ann-1");
    await toggleCard("ann-3");
    await toggleCard("ann-1"); // collapse again
    await toggleCard("ann-5");
    await expectCardsAligned();

    // Delete cards above expanded ones — index shift must not apply a stale
    // height to the surviving variable-height cards.
    await deleteCard("ann-0");
    await deleteCard("ann-2");
    await expectCardsAligned();

    // Insert at the top (manual annotations sort to index 0) — pushes every
    // card down one slot.
    await addManualAnnotation("freshly added word");
    await expectCardsAligned();

    // Mixed phase: expand, delete, collapse, insert.
    await toggleCard("ann-6");
    await deleteCard("ann-1");
    await toggleCard("ann-5"); // collapse
    await addManualAnnotation("second fresh word");
    await expectCardsAligned();

    // Final stress: expand then delete the card right below it.
    await toggleCard("ann-4");
    await deleteCard("ann-5");
    await expectCardsAligned();
  } finally {
    await app.close();
  }
});
