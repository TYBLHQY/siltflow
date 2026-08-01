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
 * Playwright hands different *files* to different workers (16-core / 15GB dev
 * box → up to 4 concurrent Electron instances ≈ 800MB, well within budget).
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
  // 6 spec files across 4 workers; the longest file (viewer-interactions,
  // 4 tests) gets its own worker while the others fan out.
  workers: 4,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
});
