import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Playwright config for Electron E2E tests.
 *
 * Electron apps are single-instance per launch, so we use a single worker.
 * Tests run against the *built* app (`dist/` + `dist-electron/`), so build
 * before running: `pnpm exec vite build`.
 *
 * Note: Electron has no headless mode — these tests need a display (X11 /
 * Wayland). On a headless CI use `xvfb-run`.
 */
export default defineConfig({
  testDir: __dirname,
  // Electron is not a browser we download; keep the default reporter/workers.
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
});
