import { test, expect } from "@playwright/test";
import { launchApp, seedDocument, openDocument, waitForPdf } from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

const SILTFLOW_DIR = ".siltflow";

// ---------------------------------------------------------------------------
// Last-read-page persistence. The app stores `lastPages` in the vault's
// `.siltflow/config.json` (written by a debounced vaultConfigSet on scroll),
// and restores it on boot via `initialPage` when opening a document.
// ---------------------------------------------------------------------------

test("document reopens on the last-read page", async () => {
  const { app, window } = await launchApp((vaultDir) => {
    const docId = seedDocument(vaultDir, FIXTURE_PDF);
    // Pre-write config.json so loadLastPages picks up the saved position
    // BEFORE the app boots (seed runs pre-launch).
    const cfgPath = path.join(vaultDir, SILTFLOW_DIR, "config.json");
    mkdirSync(path.dirname(cfgPath), { recursive: true });
    writeFileSync(cfgPath, JSON.stringify({ lastPages: { [docId]: 120 } }));
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // The viewer should have opened on page 120 (initialPage), so page 120 is
    // near the top of the viewport and we're nowhere near page 1.
    await window.waitForFunction(
      () => {
        const container =
          document.querySelector<HTMLElement>(".PdfHighlighter");
        if (!container) return false;
        const target = container.querySelector<HTMLElement>(
          '.page[data-page-number="120"]',
        );
        if (!target) return false;
        const rect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        // Page 120 is above the container's bottom edge (i.e. in/near viewport).
        return rect.top <= containerRect.bottom + 200;
      },
      { timeout: 30_000 },
    );

    // And page 1 is NOT in the viewport (we did not start at the beginning).
    const page1Visible = await window.evaluate(() => {
      const container = document.querySelector<HTMLElement>(".PdfHighlighter");
      if (!container) return true; // fail-open
      const p1 = container.querySelector<HTMLElement>(
        '.page[data-page-number="1"]',
      );
      if (!p1) return true;
      const rect = p1.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      return (
        rect.bottom >= containerRect.top && rect.top <= containerRect.bottom
      );
    });
    expect(page1Visible).toBe(false);
  } finally {
    await app.close();
  }
});

test("scrolling persists lastPages to vault config", async () => {
  const { app, window, vault } = await launchApp((vaultDir) => {
    seedDocument(vaultDir, FIXTURE_PDF);
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // Scroll the viewer to a far page (programmatic scroll triggers onPageChange
    // → setLastPage → debounced vaultConfigSet).
    await window.evaluate(() => {
      const container = document.querySelector<HTMLElement>(".PdfHighlighter");
      if (container) container.scrollTop = container.scrollHeight * 0.9;
    });

    // The debounced write is 500ms — wait comfortably past it.
    await window.waitForTimeout(2000);

    // Read the config the app wrote.
    const cfg = JSON.parse(
      readFileSync(path.join(vault, SILTFLOW_DIR, "config.json"), "utf-8"),
    );
    const lastPages = (cfg as { lastPages?: Record<string, number> }).lastPages;
    expect(lastPages).toBeTruthy();
    const docId = Object.keys(lastPages!)[0];
    expect(docId).toBeTruthy();
    // 90% of a 350-page doc is well past page 1.
    expect(lastPages![docId]).toBeGreaterThan(50);
  } finally {
    await app.close();
  }
});
