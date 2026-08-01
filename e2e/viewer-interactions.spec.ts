import { test, expect } from "@playwright/test";
import {
  launchApp,
  seedDocument,
  openDocument,
  waitForPdf,
  waitForPageInViewport,
} from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

// ---------------------------------------------------------------------------
// Zoom / page navigation / text-selection flows in the PDF viewer.
// Each test boots a fresh isolated vault so state never leaks between them.
// ---------------------------------------------------------------------------

test("fit-width toggle zooms in and back out of the viewer", async () => {
  const { app, window } = await launchApp((vault) => {
    seedDocument(vault, FIXTURE_PDF);
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // Fit-width applies via a ResizeObserver, so the scale can take a few
    // frames to land — poll the page-1 width / container-width ratio until it
    // falls in the expected band. Each waitForFunction poll re-reads the DOM.
    const waitRatio = (min: number, max: number) =>
      window.waitForFunction(
        (range) => {
          const container =
            document.querySelector<HTMLElement>(".PdfHighlighter");
          const page = container?.querySelector<HTMLElement>(
            '.page[data-page-number="1"]',
          );
          if (!container || !page) return false;
          const pageRect = page.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          if (containerRect.width === 0) return false;
          const ratio = pageRect.width / containerRect.width;
          return ratio >= range[0] && ratio <= range[1];
        },
        [min, max],
        { timeout: 15_000 },
      );

    // Fit-width is on by default: page fills container width (ratio ≈ 1).
    await waitRatio(0.95, 1.05);

    // Turn fit-width off (button toggles the flag; current zoom is preserved).
    await window.getByTitle("Fit to width").click();
    // The fit-width numeric scale is kept, so the page still spans the width —
    // fit-width simply stops tracking the container on resize.
    await waitRatio(0.9, 1.1);

    // Turn it back on — page snaps back to the container width.
    await window.getByTitle("Fit to width").click();
    await waitRatio(0.95, 1.05);
  } finally {
    await app.close();
  }
});

test("page-number input jumps to a far page", async () => {
  const { app, window } = await launchApp((vault) => {
    seedDocument(vault, FIXTURE_PDF);
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // The page-nav shows "1 / 350" by default.
    const nav = window.locator("div", { hasText: "/ 350" }).first();
    await expect(nav).toBeVisible();

    // Click the current-page button to reveal the input, type "300", Enter.
    await nav.getByTitle("Jump to page").click();
    const pageInput = nav.locator("input").first();
    await pageInput.fill("300");
    await pageInput.press("Enter");

    // Wait for the viewer to scroll to page 300 (page entered the viewport).
    await waitForPageInViewport(window, 300);

    // The nav input stays focused after Enter; its placeholder now reads the
    // jumped-to page (300), proving currentPage updated.
    await expect(pageInput).toHaveAttribute("placeholder", "300");
  } finally {
    await app.close();
  }
});

test("text selection in auto-annotate mode creates an annotation card", async () => {
  const { app, window, vault } = await launchApp((v) => {
    seedDocument(v, FIXTURE_PDF);
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // Default selection mode is auto-annotate — selecting text immediately
    // creates an annotation, no SelectionTip.
    const textLayer = window.locator(
      '.pdfViewer .page[data-page-number="1"] .textLayer',
    );
    await expect(textLayer).toBeVisible({ timeout: 20_000 });

    // Drag across the first content line. The text span is a real DOM node
    // with the selectable text; the library reads window.getSelection() on
    // mouseup, so Playwright's native mouse events produce a real selection.
    const line = textLayer
      .locator("span", { hasText: "This is content" })
      .first();
    await expect(line).toBeVisible();
    const box = await line.boundingBox();
    expect(box).not.toBeNull();
    // The span is a single word; drag across a fraction of the span's own
    // width — proportional, so it works at any window size / fit-width scale
    // (xvfb renders the page ~2× wider than a typical display). A fixed pixel
    // delta can undershoot the span on wide windows, and overshooting the
    // page's right edge bleeds the selection onto the next page, which moves
    // the selection's commonAncestorContainer outside .PdfHighlighter and the
    // library's onSelection is never fired.
    await window.mouse.move(box!.x, box!.y + box!.height / 2);
    await window.mouse.down();
    await window.mouse.move(
      box!.x + box!.width * 0.8,
      box!.y + box!.height / 2,
      { steps: 10 },
    );
    await window.mouse.up();

    // The selection created an annotation → card in the Annotations tab.
    await window.getByRole("tab", { name: "Annotations" }).click();
    const card = window.locator("[data-annotation-id]").first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText("This is content");

    // And it was persisted to the vault DB (annotation.store addItem → IPC
    // save → annotations table). The IPC save is async, so poll the DB until
    // the row lands — this proves the create path survives a restart.
    await expect
      .poll(
        () => {
          const db = new Database(path.join(vault, ".siltflow", "data.db"));
          const rows = db
            .prepare("SELECT text, kind, page_number FROM annotations")
            .all() as Array<{
            text: string;
            kind: string;
            page_number: number;
          }>;
          db.close();
          return rows;
        },
        { timeout: 15_000 },
      )
      .toEqual([
        expect.objectContaining({
          text: expect.stringContaining("This is content"),
          kind: "annotation",
          page_number: 1,
        }),
      ]);
  } finally {
    await app.close();
  }
});

test("selection mode cycles to auto-highlight and back", async () => {
  const { app, window } = await launchApp((vault) => {
    seedDocument(vault, FIXTURE_PDF);
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // Default mode is auto-annotate (PenLine icon title).
    const toggle = window.getByTitle(/^Auto-annotate/);
    await expect(toggle).toBeVisible();

    // Cycle once → auto-highlight.
    await toggle.click();
    await expect(window.getByTitle(/^Auto-highlight/)).toBeVisible();

    // Cycle again → back to manual mode (shows a SelectionTip on selection).
    await window.getByTitle(/^Auto-highlight/).click();
    await expect(window.getByTitle(/^Manual mode:/)).toBeVisible();
  } finally {
    await app.close();
  }
});
