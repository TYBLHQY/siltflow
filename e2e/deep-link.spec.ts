import { test, expect } from "@playwright/test";
import {
  launchApp,
  launchSecondInstance,
  seedDocument,
  seedDocumentMulti,
  seedFolder,
  waitForPdf,
} from "./helpers";
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

// Warm-start path: the app is already running and holds the single-instance
// lock; a second launch carries the URL and Electron forwards it to the
// primary via the `second-instance` event. Regression for the renderer
// double-consume that silently dropped warm-start links (cold start worked,
// warm start did nothing).
test("warm-start deep link opens the target document in the running app", async () => {
  let docId = "";
  const { app, window, profile } = await launchApp((vaultDir) => {
    docId = seedDocument(vaultDir, FIXTURE_PDF, "Deep-Linked Doc");
  });
  try {
    // launchApp already waited for the main UI (.split-view) — the app boots
    // with no document open (no deep link on the primary's argv). Now fire the
    // warm-start path: same profile → loses the lock → argv forwarded to the
    // primary. Never assert on this child; the running window is the oracle.
    const second = launchSecondInstance(profile, [`siltflow://open/${docId}`]);
    await expect(
      window.getByRole("heading", { name: "Deep-Linked Doc" }),
    ).toBeVisible({ timeout: 20_000 });

    // No tab switch: the app boots on Review and stays there — the deep link
    // scrolls the Review list to the target row instead of forcing Docs.
    await expect(window.getByRole("tab", { name: "Review" })).toHaveAttribute(
      "data-state",
      "active",
      { timeout: 20_000 },
    );
    await expect(window.locator('[title="Deep-Linked Doc"]')).toBeVisible();

    // The spawned instance should quit on its own after losing the lock; give
    // it a bounded window so a leak here surfaces but can't hang the test.
    await Promise.race([
      new Promise((resolve) => {
        second.once("exit", resolve);
      }),
      new Promise((resolve) => {
        setTimeout(resolve, 8_000);
      }),
    ]);
  } finally {
    await app.close();
  }
});

test("deep link on the Docs tab expands the target's folder and collapses others", async () => {
  let targetId = "";
  const { app, window, profile } = await launchApp((vaultDir) => {
    const folderA = seedFolder(vaultDir, "Folder A");
    const folderB = seedFolder(vaultDir, "Folder B");
    targetId = seedDocument(vaultDir, FIXTURE_PDF, "Target Doc", folderA);
    seedDocument(vaultDir, FIXTURE_PDF, "Other Doc", folderB);
  });
  try {
    // Switch to Docs so the tree is mounted with everything collapsed before
    // the deep link fires. (On the default Review tab these titles also exist
    // as review rows, so assert only after Docs is active.)
    await window.getByRole("tab", { name: "Docs" }).click();
    await expect(window.locator('[title="Target Doc"]')).toBeHidden();
    await expect(window.locator('[title="Other Doc"]')).toBeHidden();

    const second = launchSecondInstance(profile, [
      `siltflow://open/${targetId}`,
    ]);
    // The target's folder path opens and the node becomes visible/selected…
    await expect(window.locator('[title="Target Doc"]')).toBeVisible({
      timeout: 20_000,
    });
    // …while the sibling folder stays collapsed (its doc must not render).
    await expect(window.locator('[title="Other Doc"]')).toBeHidden();
    // And the viewer opens the document.
    await expect(
      window.getByRole("heading", { name: "Target Doc" }),
    ).toBeVisible();

    await Promise.race([
      new Promise((resolve) => {
        second.once("exit", resolve);
      }),
      new Promise((resolve) => {
        setTimeout(resolve, 8_000);
      }),
    ]);
  } finally {
    await app.close();
  }
});

test("deep link on the Review tab scrolls the virtual list to the target", async () => {
  let targetId = "";
  const { app, window, profile } = await launchApp((vaultDir) => {
    // 150 unstudied docs overflow the virtualized Review list well past the
    // render window (≈ viewport + overscan ≈ 37 rows at the test container
    // height), so the target — which sorts last by title — is genuinely
    // virtualized OUT of the initial DOM. A handful of docs renders in full
    // and never exercises the scrollToIndex path.
    const titles = Array.from(
      { length: 150 },
      (_, i) => `Doc ${String(i + 1).padStart(3, "0")}`,
    );
    seedDocumentMulti(vaultDir, FIXTURE_PDF, titles);
    targetId = seedDocument(vaultDir, FIXTURE_PDF, "Target Doc");
  });
  try {
    // Review is the default tab. All docs are unstudied (compositeScore -1),
    // so urgency ties and the list sorts by title — "Target Doc" is last,
    // beyond the virtualizer's render window → not in the DOM at all.
    await expect(window.locator('[title="Target Doc"]')).toBeHidden();

    const second = launchSecondInstance(profile, [
      `siltflow://open/${targetId}`,
    ]);
    // The deep link scrolls the Review list down to the target row.
    await expect(window.locator('[title="Target Doc"]')).toBeVisible({
      timeout: 20_000,
    });

    await Promise.race([
      new Promise((resolve) => {
        second.once("exit", resolve);
      }),
      new Promise((resolve) => {
        setTimeout(resolve, 8_000);
      }),
    ]);
  } finally {
    await app.close();
  }
});
