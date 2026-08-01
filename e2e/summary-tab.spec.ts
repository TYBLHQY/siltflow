import { test, expect } from "@playwright/test";
import {
  launchApp,
  seedDocument,
  seedSummary,
  openDocument,
  waitForPdf,
} from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

const SUMMARY_TEXT =
  "This is a pre-seeded AI summary for the E2E PDF. It describes the document's core arguments from a language learner's perspective.";

// ---------------------------------------------------------------------------
// Summary tab — page selection + rendering a persisted summary.
// Summaries are persisted to the vault (summaries table) and restored on
// boot, so we can seed one directly instead of hitting a real AI provider.
// ---------------------------------------------------------------------------

test("summary tab renders a seeded summary and edits it", async () => {
  const { app, window } = await launchApp((vault) => {
    const docId = seedDocument(vault, FIXTURE_PDF);
    seedSummary(vault, docId, SUMMARY_TEXT);
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // Switch to the Summary tab.
    await window.getByRole("tab", { name: "Summary" }).click();

    // Seeded summary renders with the "AI-generated" badge.
    await expect(window.getByText(SUMMARY_TEXT, { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(window.getByText("AI-generated")).toBeVisible();

    // 350 pages are listed. RightPanel seeds selectedPages=[1] after page-text
    // extraction completes — wait for that settled state (page 1 selected,
    // page 2 unselected) before asserting on toggling.
    const pagesToggle = window.getByRole("button", { name: /350 pages/ });
    await expect(pagesToggle).toBeVisible();
    // Scope page-number buttons to the Summary panel — the center toolbar's
    // PageNav also renders numeric buttons ("1", "2", …) for jumping.
    const summaryPanel = window.getByLabel("Summary");
    const page1Btn = summaryPanel.getByRole("button", {
      name: "1",
      exact: true,
    });
    const page2Btn = summaryPanel.getByRole("button", {
      name: "2",
      exact: true,
    });
    await expect(page1Btn).toHaveClass(/bg-ctp-mauve\/10/);
    await expect(page2Btn).not.toHaveClass(/bg-ctp-mauve\/10/);

    // Click page 5 → it becomes selected (mauve background).
    const page5Btn = summaryPanel.getByRole("button", {
      name: "5",
      exact: true,
    });
    await page5Btn.click();
    await expect(page5Btn).toHaveClass(/bg-ctp-mauve\/10/);

    // Click again → deselected.
    await page5Btn.click();
    await expect(page5Btn).not.toHaveClass(/bg-ctp-mauve\/10/);
  } finally {
    await app.close();
  }
});

test("summary edit mode round-trips and clears", async () => {
  const { app, window } = await launchApp((vault) => {
    const docId = seedDocument(vault, FIXTURE_PDF);
    seedSummary(vault, docId, SUMMARY_TEXT);
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);
    await window.getByRole("tab", { name: "Summary" }).click();
    await expect(window.getByText(SUMMARY_TEXT, { exact: true })).toBeVisible();

    // Enter edit mode — textarea with the summary text.
    await window.getByRole("button", { name: "Edit" }).click();
    const textarea = window.locator("textarea").last();
    await expect(textarea).toBeVisible();

    // Editing live-updates the store (SummaryTab's textarea calls setSummary
    // on each keystroke). Cancel merely exits edit mode — the edited text
    // stays in the store, rendered back as a paragraph.
    const editedText = `${SUMMARY_TEXT} [edited]`;
    await textarea.fill(editedText);
    await window.getByRole("button", { name: "Cancel" }).click();
    await expect(window.getByText(editedText, { exact: true })).toBeVisible();
    await expect(window.getByText(SUMMARY_TEXT, { exact: true })).toHaveCount(
      0,
    );

    // Clear the summary entirely → empty-state text appears.
    await window.getByRole("button", { name: "Clear" }).click();
    await expect(
      window.getByText("Select pages above and click AI Summarize"),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});
