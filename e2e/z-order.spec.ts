import { test, expect } from "@playwright/test";
import {
  launchApp,
  seedDocument,
  seedAnnotation,
  makePosition,
  openDocument,
  waitForPdf,
} from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

// Z-order regression: when a small annotation (a word) is contained inside a
// larger annotation (the sentence around it), reloading must still leave the
// word clickable. Highlights render in array order — the LAST one sits on top
// of the DOM and captures clicks — so PdfViewer sorts items by coverage area
// ascending, putting the contained word on top.
//
// This test seeds BOTH annotations into the vault DB (reload path: the app
// loads them via annotations:list → store → PdfViewer sorting) and clicks the
// narrowest rendered part, which is the word. The right panel card for the
// word must open.
test("contained word highlight is clickable after reload (z-order)", async () => {
  const WORD = "easiest";
  const SENT = "When symmetry permits, it affords by far the quickest and easiest way of computing electric fields.";

  const { app, window } = await launchApp((vault) => {
    const docId = seedDocument(vault, FIXTURE_PDF, "E2E Test PDF");
    // Word is a small band; sentence is a larger band over the same region.
    seedAnnotation(vault, docId, {
      id: "sent-ann",
      pageNumber: 1,
      text: SENT,
      position: makePosition(1, { x1: 50, y1: 100, x2: 400, y2: 140 }),
    });
    seedAnnotation(vault, docId, {
      id: "word-ann",
      pageNumber: 1,
      text: WORD,
      position: makePosition(1, { x1: 50, y1: 100, x2: 140, y2: 120 }),
    });
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // Capture the annotation-click events dispatched by the renderer.
    await window.evaluate(() => {
      (window as unknown as { __zclicks: string[] }).__zclicks = [];
      window.addEventListener(
        "siltflow:annotation-click",
        ((e: CustomEvent) => {
          (window as unknown as { __zclicks: string[] }).__zclicks.push(
            e.detail?.id,
          );
        }) as EventListener,
      );
    });

    // Wait for the highlight layer to render both parts.
    await window.waitForSelector(
      ".PdfHighlighter__highlight-layer .TextHighlight__part",
    );

    // Pick the narrowest rendered part — that's the contained word.
    const center = await window.evaluate(() => {
      const parts = [
        ...document.querySelectorAll(
          ".PdfHighlighter__highlight-layer .TextHighlight__part",
        ),
      ] as HTMLElement[];
      const target = parts.sort(
        (a, b) =>
          a.getBoundingClientRect().width - b.getBoundingClientRect().width,
      )[0];
      const r = target.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    await window.mouse.click(center.x, center.y);

    // The word annotation must be the one that received the click.
    await window.waitForFunction(() =>
      (window as unknown as { __zclicks: string[] }).__zclicks.includes(
        "word-ann",
      ),
    );

    // Right panel expands the word's card (the click feedback chain).
    await expect(
      window.locator('[data-annotation-id="word-ann"]'),
    ).toBeVisible({ timeout: 20_000 });
  } finally {
    await app.close();
  }
});
