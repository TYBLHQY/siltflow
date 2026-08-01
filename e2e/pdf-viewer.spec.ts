import { test, expect } from "@playwright/test";
import { launchApp, seedDocument, seedAnnotation } from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

test("opens a seeded PDF and fit-width fills the viewer", async () => {
  const { app, window } = await launchApp((vault) => {
    seedDocument(vault, FIXTURE_PDF);
  });
  try {
    await window.getByRole("tab", { name: "Docs" }).click();
    const docNode = window.locator(`[title="E2E Test PDF"]`);
    await expect(docNode).toBeVisible({ timeout: 20_000 });
    await docNode.click();

    // The PDF viewer mounts.
    await window.waitForSelector(".PdfHighlighter", { timeout: 30_000 });
    await window.waitForSelector(".pdfViewer .page", { timeout: 30_000 });

    // Fit-width is on by default: the first rendered page should span the
    // viewer's content width (within a small tolerance).
    const pageWidthInfo = await window.evaluate(() => {
      const container = document.querySelector<HTMLElement>(".PdfHighlighter");
      const firstPage = container?.querySelector<HTMLElement>(
        '.page[data-page-number="1"]',
      );
      if (!container || !firstPage) return null;
      const pageRect = firstPage.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      return {
        pageWidth: pageRect.width,
        containerWidth: containerRect.width,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
        scrollTop: container.scrollTop,
      };
    });
    expect(pageWidthInfo).not.toBeNull();
    // Page width should match the container width (fit-to-width).
    expect(pageWidthInfo!.pageWidth).toBeGreaterThan(
      pageWidthInfo!.containerWidth * 0.95,
    );
    expect(pageWidthInfo!.pageWidth).toBeLessThanOrEqual(
      pageWidthInfo!.containerWidth * 1.05,
    );
  } finally {
    await app.close();
  }
});

test("scrolls to a far-page highlight from the annotations card", async () => {
  const { app, window } = await launchApp((vault) => {
    const docId = seedDocument(vault, FIXTURE_PDF);
    seedAnnotation(vault, docId, {
      id: "ann-p300",
      pageNumber: 300,
      text: "E2E far-page annotation",
      position: {
        boundingRect: {
          x1: 50,
          y1: 350,
          x2: 300,
          y2: 370,
          width: 612,
          height: 792,
          pageNumber: 300,
        },
        rects: [
          {
            x1: 50,
            y1: 350,
            x2: 300,
            y2: 370,
            width: 612,
            height: 792,
            pageNumber: 300,
          },
        ],
        usePdfCoordinates: false,
      },
    });
  });
  try {
    await window.getByRole("tab", { name: "Docs" }).click();
    await window.locator(`[title="E2E Test PDF"]`).click();
    await window.waitForSelector(".PdfHighlighter", { timeout: 30_000 });
    await window.waitForSelector(".pdfViewer .page", { timeout: 30_000 });

    // Switch to the Annotations tab in the right panel.
    await window.getByRole("tab", { name: "Annotations" }).click();
    const card = window.locator('[data-annotation-id="ann-p300"]');
    await expect(card).toBeVisible({ timeout: 20_000 });

    // Click the "go to highlight" button on the card → scrolls to page 300.
    const goTo = card.locator('[title="Go to highlight in PDF"]');
    await goTo.click();

    // Wait for the viewer to scroll near the target (page 300 of 350).
    // Smooth-scrolling 300 pages is frame-rate-bound — under parallel-worker
    // CPU contention it can take well over 30s, so allow a generous budget.
    await window.waitForFunction(
      () => {
        const container =
          document.querySelector<HTMLElement>(".PdfHighlighter");
        if (!container) return false;
        // We've reached the target if the target page is within the viewport.
        const targetPage = container.querySelector<HTMLElement>(
          '.page[data-page-number="300"]',
        );
        if (!targetPage) return false;
        const pageRect = targetPage.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        // Page top is at or above container bottom (page entered the viewport).
        return pageRect.top <= containerRect.bottom + 200;
      },
      { timeout: 60_000 },
    );

    // Sanity: scroll position is far from the top (we actually moved).
    const scrollInfo = await window.evaluate(() => {
      const container = document.querySelector<HTMLElement>(".PdfHighlighter");
      return container
        ? {
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
          }
        : null;
    });
    expect(scrollInfo).not.toBeNull();
    expect(scrollInfo!.scrollTop).toBeGreaterThan(
      scrollInfo!.scrollHeight * 0.5,
    );
  } finally {
    await app.close();
  }
});
