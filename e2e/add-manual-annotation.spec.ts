import { test, expect } from "@playwright/test";
import { launchApp, seedDocument, openDocument, waitForPdf } from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

// ---------------------------------------------------------------------------
// ctrl+T — "Add manual annotation" shortcut.
// The dialog visibility lives in the annotation store, so the shortcut works
// even when the Annotations tab is unmounted (right panel collapsed, or on
// the Summary tab). It also auto-expands the right panel / switches to the
// Annotations tab. Each case below exercises a different mount path.
// ---------------------------------------------------------------------------

test("ctrl+T opens the manual annotation dialog from the Annotations tab", async () => {
  const { app, window } = await launchApp((vault) => {
    seedDocument(vault, FIXTURE_PDF);
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // Annotations tab is active by default; the tab is mounted, so this is
    // the simplest path — the shortcut just opens the dialog.
    await window.keyboard.press("Control+t");

    // The dialog renders via a Radix portal.
    await expect(window.getByText("Add Manual Annotation")).toBeVisible({
      timeout: 20_000,
    });
  } finally {
    await app.close();
  }
});

test("ctrl+T from the Summary tab reopens Annotations and opens the dialog", async () => {
  const { app, window } = await launchApp((vault) => {
    seedDocument(vault, FIXTURE_PDF);
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // Switch to the Summary tab — this unmounts AnnotationsTab. This is the
    // exact case where the dialog's open state must survive in the store.
    await window.getByRole("tab", { name: "Summary" }).click();
    await expect(window.getByRole("tab", { name: "Summary" })).toHaveAttribute(
      "data-state",
      "active",
    );

    await window.keyboard.press("Control+t");

    // The shortcut auto-switches back to the Annotations tab and opens the
    // dialog once the freshly-mounted tab reads the store state. The dialog
    // is a Radix modal, so while it's open the tabs behind it are aria-hidden
    // and unreachable — assert the dialog first.
    await expect(window.getByText("Add Manual Annotation")).toBeVisible({
      timeout: 20_000,
    });

    // Close the dialog to reveal the tabs again, then confirm the shortcut
    // actually switched to the Annotations tab.
    await window.getByRole("button", { name: "Cancel" }).click();
    await expect(
      window.getByRole("tab", { name: "Annotations" }),
    ).toHaveAttribute("data-state", "active");
    await expect(
      window.getByRole("tab", { name: "Summary" }),
    ).not.toHaveAttribute("data-state", "active");
  } finally {
    await app.close();
  }
});

test("ctrl+T expands a collapsed right panel and opens the dialog", async () => {
  const { app, window } = await launchApp((vault) => {
    seedDocument(vault, FIXTURE_PDF);
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // Collapse the right panel (Alt+]) — this also unmounts AnnotationsTab.
    await window.keyboard.press("Alt+]");

    await window.keyboard.press("Control+t");

    // The dialog renders via a portal; its visibility proves the store state
    // was set even though the panel had to be re-expanded first.
    await expect(window.getByText("Add Manual Annotation")).toBeVisible({
      timeout: 20_000,
    });
  } finally {
    await app.close();
  }
});
