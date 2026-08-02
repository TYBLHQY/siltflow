import { test, expect } from "@playwright/test";
import {
  launchApp,
  seedDocumentMulti,
  openDocument,
  waitForPdf,
} from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

// ---------------------------------------------------------------------------
// Switching PDFs must not log pdf.js's "scrollPageIntoView: N is not a valid
// pageNumber parameter." error.
//
// The error fires when the library applies a numeric scale to a freshly
// setDocument'ed viewer BEFORE pdf.js has built its `_pages` array (the
// pagesinit tick is async). The numeric scale can be stale from the previous
// document (the app's fit-width numeric-scale fix, commit b5937bc) — a reset
// to 0 on document switch makes the library fall back to "auto", which
// safely no-ops until pages are ready.
// ---------------------------------------------------------------------------

test("first open logs no scrollPageIntoView error", async () => {
  const { app, window } = await launchApp((vault) => {
    seedDocumentMulti(vault, FIXTURE_PDF, ["Doc A", "Doc B"]);
  });

  const badPageErrors: string[] = [];
  window.on("console", (msg) => {
    if (msg.text().includes("is not a valid pageNumber parameter")) {
      badPageErrors.push(msg.text());
    }
  });

  try {
    await openDocument(window, "Doc A");
    await waitForPdf(window);

    // Give any async renderer console error a beat to surface.
    await window.waitForTimeout(500);
    expect(
      badPageErrors,
      "first open must not log a scrollPageIntoView pageNumber error",
    ).toEqual([]);
  } finally {
    await app.close();
  }
});

test("switching documents logs no scrollPageIntoView error", async () => {
  const { app, window } = await launchApp((vault) => {
    seedDocumentMulti(vault, FIXTURE_PDF, ["Doc A", "Doc B"]);
  });

  const badPageErrors: string[] = [];
  window.on("console", (msg) => {
    if (msg.text().includes("is not a valid pageNumber parameter")) {
      badPageErrors.push(msg.text());
    }
  });

  try {
    // Open the first document, then switch to the second — the moment the
    // stale numeric scale from Doc A used to be applied to Doc B's
    // not-yet-built pages.
    await openDocument(window, "Doc A");
    await waitForPdf(window);

    await openDocument(window, "Doc B");
    await waitForPdf(window);

    // Wait for the new document's pagesinit + fit-width scale application to
    // settle (the error, if present, fires during this mount).
    await window.waitForTimeout(1000);
    expect(
      badPageErrors,
      "switching documents must not log a scrollPageIntoView pageNumber error",
    ).toEqual([]);
  } finally {
    await app.close();
  }
});
