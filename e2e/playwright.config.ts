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
 * workers: 2 — a good middle ground. 4 concurrent Electron instances rasterizing
 * a 350-page PDF contends for CPU and makes the far-page smooth-scroll test
 * time out (~1/3 of runs at 4). 2 workers keep ~1.6× speedup over serial with
 * far less contention.
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
  workers: 2,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
});
