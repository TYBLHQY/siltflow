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

// ---------------------------------------------------------------------------
// Spaced-repetition learning flow (Start Learning → StudyPanel → rate cards).
// Annotations without an FSRS card are always "due", so two seeded annotations
// are enough to drive a full session with no AI or card seed needed.
// ---------------------------------------------------------------------------

test("start learning runs a full session and completes", async () => {
  const { app, window } = await launchApp((vault) => {
    const docId = seedDocument(vault, FIXTURE_PDF);
    seedAnnotation(vault, docId, {
      id: "learn-a",
      pageNumber: 1,
      text: "first flashcard",
      position: makePosition(1),
    });
    seedAnnotation(vault, docId, {
      id: "learn-b",
      pageNumber: 2,
      text: "second flashcard",
      position: makePosition(2),
    });
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);
    await window.getByRole("tab", { name: "Annotations" }).click();

    // Start Learning button shows the due count [2] and is enabled.
    const startBtn = window.getByTitle("Start Learning");
    await expect(startBtn).toHaveText(/\[2\]/);
    await startBtn.click();

    // StudyPanel opens as a modal dialog. Card order isn't guaranteed (the
    // annotation list is reversed on load), so anchor on the "Tap to reveal"
    // hint instead of a specific card's text.
    const dialog = window.locator('[role="dialog"]:visible');
    const revealHint = dialog.getByText("Tap to reveal answer");
    await expect(revealHint).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText("1 / 2")).toBeVisible();

    // Reveal the answer → rating buttons appear.
    await dialog.getByText("Tap to reveal answer").click();
    const again = dialog.getByRole("button", { name: "Again", exact: true });
    await expect(again).toBeVisible();

    // Rate "Good" → advances to card 2 of 2.
    await dialog.getByRole("button", { name: "Good", exact: true }).click();
    await expect(dialog.getByText("2 / 2")).toBeVisible();

    // Reveal + rate the second card → session completes with a success toast.
    await dialog.getByText("Tap to reveal answer").click();
    await dialog.getByRole("button", { name: "Good", exact: true }).click();
    await expect(window.getByText("All cards reviewed! Good job!")).toBeVisible(
      { timeout: 20_000 },
    );

    // The modal closes back to the annotation list.
    await expect(window.getByText("All cards reviewed! Good job!")).toHaveCount(
      0,
      { timeout: 10_000 },
    );
    await expect(
      window.locator('[data-annotation-id="learn-a"]'),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});
