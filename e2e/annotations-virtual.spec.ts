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

// Compact V2 result so the card renders (source text = normalized input).
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

// The annotations list is virtualized (TanStack Virtual, measureElement).
// With 200 cards only the viewport window + overscan should be in the DOM, and
// the first card visible while a far card is virtualized out entirely.
test("annotations list virtualizes — only visible cards render", async () => {
  const { app, window } = await launchApp((vault) => {
    const docId = seedDocument(vault, FIXTURE_PDF);
    for (let i = 0; i < 200; i++) {
      seedAIV2Annotation(vault, docId, {
        id: `ann-${i}`,
        pageNumber: 1 + i,
        text: `word ${i}`,
        aiResult: makeCompact(`w${i}`),
        position: makePosition(1 + i),
      });
    }
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);
    await window.getByRole("tab", { name: "Annotations" }).click();

    // First card is rendered (sorted first by page)…
    await expect(window.locator('[data-annotation-id="ann-0"]')).toBeVisible();
    // …a far card is NOT in the DOM at all (virtualized out).
    await expect(window.locator('[data-annotation-id="ann-199"]')).toBeHidden();
    // The rendered window is a small fraction of the 200 cards.
    const rendered = await window.locator("[data-annotation-id]").count();
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(200);
  } finally {
    await app.close();
  }
});
