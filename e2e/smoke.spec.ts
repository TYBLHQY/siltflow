import { test, expect } from "@playwright/test";
import { launchApp, seedDocument, openDocument, waitForPdf } from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

// ---------------------------------------------------------------------------
// Smoke test — boot self-check subset of the E2E suite.
//
// Fastest signal that the *built* app actually works: launch → main 3-pane
// UI → open a seeded PDF → first page rasterizes with a visible text layer →
// page-nav reports 350 pages → main process reachable via app.evaluate.
//
// Deliberately does NOT build first (same convention as `test:e2e` — run
// `pnpm exec vite build` before). Standalone: pnpm test:e2e:smoke
// ---------------------------------------------------------------------------

test("app boots and renders the first page of a PDF", async () => {
  const { app, window } = await launchApp((vault) => {
    seedDocument(vault, FIXTURE_PDF);
  });
  try {
    // 1. Main process is alive and reachable (first app.evaluate usage).
    //    process.versions.electron is only populated inside the real Electron
    //    runtime — this proves the app under test is Electron.
    const electronVersion = await app.evaluate(() => process.versions.electron);
    expect(electronVersion).toBeTruthy();

    // 2. Docs tab → seeded doc → PDF viewer mounts.
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // 3. Page 1 rasterized AND its text layer rendered (visible spans).
    //    .textLayer spans are appended by pdf.js render() after the page
    //    canvas — later and more reliable than bare .page presence.
    const textLayer = window.locator(
      '.pdfViewer .page[data-page-number="1"] .textLayer',
    );
    await expect(textLayer).toBeVisible({ timeout: 20_000 });

    // 4. First content line is selectable text, not just a blank raster.
    //    Substring match (hasText) — pdf.js splits whitespace/newlines into
    //    multiple spans, so an exact match would be brittle.
    const line = textLayer
      .locator("span", { hasText: "This is content" })
      .first();
    await expect(line).toBeVisible();

    // 5. 350-page doc fully parsed: page-nav shows "/ 350" (from
    //    pdfDocument.numPages, which only resolves after getDocument()).
    const nav = window.locator("div", { hasText: "/ 350" }).first();
    await expect(nav).toBeVisible();
  } finally {
    await app.close();
  }
});
