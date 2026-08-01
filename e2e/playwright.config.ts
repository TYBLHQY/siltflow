import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Playwright config for Electron E2E tests.
 *
 * The app has no single-instance lock, so tests may run in parallel — each
 * `launchApp` boots an isolated Electron instance with its own `--user-data-dir`
 * and temp vault. `fullyParallel: false` keeps each spec file serial, but
 * Playwright hands different *files* to different workers.
 *
 * workers: 1 — serial. Concurrent Electron instances rasterizing a 350-page PDF
 * contend for CPU; under contention the text-selection tests become flaky
 * (the selection's commonAncestorContainer lands outside .PdfHighlighter and
 * onSelection never fires). Serial costs ~1.5–2× wall-clock but is reliable,
 * which matters more for a blocking CI gate.
 *
 * Tests run against the *built* app (`dist/` + `dist-electron/`), so build
 * before running: `pnpm exec vite build`.
 *
 * Note: Electron has no headless mode — these tests need a display (X11 /
 * Wayland). On a headless CI use `xvfb-run`.
 */
export default defineConfig({
  testDir: __dirname,
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
});
