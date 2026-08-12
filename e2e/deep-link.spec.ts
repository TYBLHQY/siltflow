import { test, expect } from "@playwright/test";
import { launchApp, seedDocument, waitForPdf } from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

// ---------------------------------------------------------------------------
// External deep links (siltflow://open/<documentId>) open a document by id.
// The URL is passed as a process argv on launch (the Windows/Linux cold-start
// path); the app must open the PDF without any tree interaction. Unknown ids
// surface a "document not found" toast instead of a blank viewer.
// ---------------------------------------------------------------------------

test("cold-start deep link opens the target document", async () => {
  let docId = "";
  const { app, window } = await launchApp(
    (vaultDir) => {
      docId = seedDocument(vaultDir, FIXTURE_PDF, "Deep-Linked Doc");
    },
    () => [`siltflow://open/${docId}`],
  );
  try {
    await waitForPdf(window);
    await expect(
      window.getByRole("heading", { name: "Deep-Linked Doc" }),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("deep link with an unknown document id shows a not-found toast", async () => {
  const { app, window } = await launchApp(
    (vaultDir) => {
      seedDocument(vaultDir, FIXTURE_PDF);
    },
    () => [`siltflow://open/${randomUUID()}`],
  );
  try {
    await expect(window.getByText("文档不存在或已被删除")).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    await app.close();
  }
});
