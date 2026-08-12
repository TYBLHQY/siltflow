import { test, expect } from "@playwright/test";
import {
  launchApp,
  seedDocument,
  seedAnnotation,
  makePosition,
} from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

// Review tab's virtual list (TanStack Virtual) used to throw "flushSync was
// called from inside a lifecycle method" — measureElement runs as a ref
// callback during a React commit, and the virtualizer's default `useFlushSync`
// forces a synchronous re-render inside that lifecycle method. The app opts
// out with `useFlushSync: false`; this test guards that no such error surfaces
// on boot (Review is the default left tab, so the list mounts immediately).
test("review virtual list emits no flushSync lifecycle error", async () => {
  const errors: string[] = [];
  const { app, window } = await launchApp((vaultDir) => {
    const docId = seedDocument(vaultDir, FIXTURE_PDF, "FlushSync Doc");
    seedAnnotation(vaultDir, docId, {
      id: randomUUID(),
      pageNumber: 1,
      text: "sample",
      position: makePosition(1),
    });
  });
  window.on("pageerror", (e) => errors.push(String(e)));
  window.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  try {
    // Review is the default left tab; a seeded doc with metrics renders the
    // virtualized list, exercising measureElement on boot.
    await window.waitForSelector('[title="FlushSync Doc"]', {
      timeout: 30_000,
    });
    await window.waitForTimeout(1_000);
    expect(errors.filter((e) => e.includes("flushSync"))).toEqual([]);
  } finally {
    await app.close();
  }
});
