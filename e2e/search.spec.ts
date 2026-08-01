import { test, expect } from "@playwright/test";
import {
  launchApp,
  seedDocument,
  seedDocumentMulti,
  seedAnnotation,
  makePosition,
  openDocument,
  waitForPdf,
  waitForPageInViewport,
} from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

// ---------------------------------------------------------------------------
// Search annotations (Ctrl+F dialog) — cross-document Fuse index.
// ---------------------------------------------------------------------------

test("search finds an annotation and jumping navigates + scrolls", async () => {
  const { app, window } = await launchApp((vault) => {
    const docId = seedDocument(vault, FIXTURE_PDF);
    seedAnnotation(vault, docId, {
      id: "ann-search",
      pageNumber: 7,
      text: "unique giraffe annotation for search",
      position: makePosition(7),
    });
    // A second document that must NOT match the query.
    seedDocumentMulti(vault, FIXTURE_PDF, ["Unrelated Doc"]);
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // Open search (Ctrl+F button in the toolbar).
    await window.getByTitle("Search annotations (Ctrl+F)").click();

    // Index builds asynchronously on first open; wait for the input.
    const searchInput = window.getByPlaceholder("Search annotations…");
    await expect(searchInput).toBeVisible({ timeout: 20_000 });

    // Type a distinctive token — fuse matches the unique annotation only.
    await searchInput.fill("giraffe");
    // The annotation text also renders in the right-panel card, so scope the
    // assertion to the search dialog's result list.
    const dialog = window.locator('[role="dialog"]');
    const result = dialog.getByText("unique giraffe annotation for search");
    await expect(result).toBeVisible({ timeout: 20_000 });
    // "Unrelated Doc" must not appear as a search result (it's still visible
    // in the left docs tree, so scope the check to the dialog body).
    await expect(dialog.getByText("Unrelated Doc")).toHaveCount(0);

    // Jump to the annotation (button in the result row) → dialog closes,
    // PDF scrolls to page 7, right panel expands the matching card.
    await window.getByTitle("Jump to annotation").first().click();
    await expect(window.getByPlaceholder("Search annotations…")).toHaveCount(0);

    // Viewer scrolled near page 7.
    await waitForPageInViewport(window, 7);

    // The matching annotation card is shown (annotation-click event expanded it).
    await expect(
      window.locator('[data-annotation-id="ann-search"]'),
    ).toBeVisible({ timeout: 20_000 });
  } finally {
    await app.close();
  }
});

test("search dialog shows an empty state when nothing matches", async () => {
  const { app, window } = await launchApp((vault) => {
    const docId = seedDocument(vault, FIXTURE_PDF);
    seedAnnotation(vault, docId, {
      id: "ann-a",
      pageNumber: 1,
      text: "alpha beta gamma",
      position: makePosition(1),
    });
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);
    await window.getByTitle("Search annotations (Ctrl+F)").click();
    const searchInput = window.getByPlaceholder("Search annotations…");
    await expect(searchInput).toBeVisible({ timeout: 20_000 });

    // A query with no matches → "No annotations match" empty state.
    await searchInput.fill("zzzz_no_match_zzzz");
    await expect(window.getByText(/No annotations match/)).toBeVisible({
      timeout: 20_000,
    });
  } finally {
    await app.close();
  }
});
