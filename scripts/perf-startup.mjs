#!/usr/bin/env node
// scripts/perf-startup.mjs
//
// Startup perf probe for Siltflow — no assertions, human-readable trend data.
//
// Drives the real built app (dist-electron/main.js) via Playwright's
// `_electron.launch`, then reads main-process metrics (boot→whenReady time,
// per-process memory / cumulative CPU) and renderer load stages, printing an
// ASCII table. Compare numbers across runs by eye.
//
// Run:            pnpm perf:startup
// Prereq:         pnpm exec vite build   (probe targets built artifacts)
// Exit:           auto-closes the app and cleans temp vault/profile dirs.

import { _electron as electron } from "@playwright/test";
import {
  mkdirSync,
  mkdtempSync,
  copyFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ELECTRON_BINARY = path.join(
  PROJECT_ROOT,
  "node_modules",
  "electron",
  "dist",
  "electron",
);
const MAIN_SCRIPT = path.join(PROJECT_ROOT, "dist-electron", "main.js");
const FIXTURE_PDF = path.join(PROJECT_ROOT, "e2e", "fixtures", "test-350.pdf");

// --- Pre-flight: the probe reads the *built* app. Fail loudly instead of
// silently measuring a stale dist/. -------------------------------------------------
if (
  !existsSync(MAIN_SCRIPT) ||
  !existsSync(path.join(PROJECT_ROOT, "dist", "index.html"))
) {
  console.error(
    "dist-electron/main.js or dist/index.html not found — run `pnpm exec vite build` first.",
  );
  process.exit(1);
}

// --- Inline minimal seed: one document row + the fixture PDF, mirroring
// e2e/helpers.ts (openVaultDb + seedDocument) minus the annotation/summary
// tables — the app's own initDatabase creates those on open. -----------------------
function seedDocument(vault, pdfPath) {
  const id = randomUUID();
  const docsDir = path.join(vault, "documents");
  if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });
  copyFileSync(pdfPath, path.join(docsDir, `${id}.pdf`));

  const db = new Database(path.join(vault, ".siltflow", "data.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      original_name TEXT,
      total_pages INTEGER,
      metadata TEXT,
      folder_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO documents (id, title, original_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, "Perf Test PDF", path.basename(pdfPath), now, now);
  db.close();
}

// --- Boot the app against an isolated temp vault + profile (mirrors
// e2e/helpers.ts launchApp): preseed vault-path.json under --user-data-dir to
// skip VaultSetup, and disable the startup update check so no dialog overlays. ---
const vault = mkdtempSync(path.join(tmpdir(), "siltflow-perf-vault-"));
mkdirSync(path.join(vault, "documents"), { recursive: true });
mkdirSync(path.join(vault, ".siltflow"), { recursive: true });
seedDocument(vault, FIXTURE_PDF);

const cfgPath = path.join(vault, ".siltflow", "config.json");
writeFileSync(
  cfgPath,
  JSON.stringify({ appSettings: { checkUpdateOnStartup: false } }),
);

const profile = mkdtempSync(path.join(tmpdir(), "siltflow-perf-profile-"));
writeFileSync(
  path.join(profile, "vault-path.json"),
  JSON.stringify({ vaultPath: vault }),
);

let app;
const cleanup = () => {
  for (const dir of [vault, profile]) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* already gone */
    }
  }
};

async function main() {
  const tLaunchStart = Date.now();
  app = await electron.launch({
    executablePath: ELECTRON_BINARY,
    args: [MAIN_SCRIPT, `--user-data-dir=${profile}`],
    env: { ...process.env, NODE_ENV: "production" },
    timeout: 45_000,
  });
  // Auto-clean temp dirs on exit, regardless of how the app terminates.
  app.once("close", cleanup);

  const tFirstWindow = Date.now();
  const window = await app.firstWindow();

  const tDom = Date.now();
  await window.waitForLoadState("domcontentloaded", { timeout: 30_000 });

  // The PDF viewer only mounts once a document is open, so explicitly open the
  // seeded doc (mirrors e2e/helpers.ts openDocument): Docs tab → tree node.
  const tOpen = Date.now();
  await window.getByRole("tab", { name: "Docs" }).click();
  await window
    .locator('[title="Perf Test PDF"]')
    .first()
    .click({ timeout: 20_000 });

  const tViewer = Date.now();
  await window.waitForSelector(".PdfHighlighter", { timeout: 30_000 });

  const tPage = Date.now();
  await window.waitForSelector(".pdfViewer .page", { timeout: 30_000 });

  // --- Main-process metrics. `app.evaluate` runs inside the Electron main
  // process, where app.getAppMetrics()/process.uptime() are available.
  //   boot.uptimeMs  = wall-clock since the main process started; app.whenReady
  //                    has already resolved by the time we evaluate, so this IS
  //                    the "launch → ready" time (NOT process.getCreationTime(),
  //                    which would measure total elapsed to this sample point).
  //   metrics[].memory.workingSetSize is in KB → /1024 for MB.
  //
  // Note: Playwright passes the *electron module* as the first argument to the
  // evaluate callback — there is no global `app` inside the main-process eval
  // scope, so destructure `electron.app` (standard Playwright API).
  const metrics = await app.evaluate((electron) => {
    const mainApp = electron.app;
    const readyMs = process.uptime() * 1000;
    const procs = mainApp.getAppMetrics().map((m) => ({
      type: m.type,
      name: m.name ?? "",
      pid: m.pid,
      cpuSec: m.cpu ? m.cpu.cumulativeCPUUsage : 0,
      wsKb: m.memory ? m.memory.workingSetSize : 0,
      privateKb: m.memory ? (m.memory.privateBytes ?? 0) : 0,
    }));
    return {
      electron: process.versions.electron,
      readyMs,
      procs,
    };
  });

  const stageMs = {
    launchToFirstWindow: tFirstWindow - tLaunchStart,
    firstWindowToDom: tDom - tFirstWindow,
    domToOpenDoc: tOpen - tDom,
    openDocToViewer: tViewer - tOpen,
    viewerToPage: tPage - tViewer,
  };

  // --- Pretty table ----------------------------------------------------------
  const fmtMB = (kb) => `${(kb / 1024).toFixed(1)}MB`;
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\n=== Siltflow startup perf (${new Date().toISOString()}) ===`);
  console.log(
    `electron ${metrics.electron} | boot→whenReady ${metrics.readyMs.toFixed(0)}ms | app.getAppMetrics() after PDF page 1`,
  );
  console.log(
    `launch→firstWindow ${stageMs.launchToFirstWindow}ms | →domcontentloaded ${stageMs.firstWindowToDom}ms | →openDoc ${stageMs.domToOpenDoc}ms | →viewer ${stageMs.openDocToViewer}ms | →page1 ${stageMs.viewerToPage}ms`,
  );
  const header = ["Type", "Name", "PID", "CPU(s)", "WS", "Priv"];
  console.log(header.map((h, i) => pad(h, [10, 22, 6, 8, 9, 9][i])).join(""));
  for (const p of metrics.procs) {
    console.log(
      pad(p.type, 10) +
        pad(p.name, 22) +
        pad(p.pid, 6) +
        pad(p.cpuSec.toFixed(2), 8) +
        pad(fmtMB(p.wsKb), 9) +
        pad(p.privateKb ? fmtMB(p.privateKb) : "-", 9),
    );
  }
  console.log(
    "\nNo assertions — compare these numbers across runs to spot trends.\n",
  );
}

try {
  await main();
} finally {
  // `app.close()` fires the app's own 'close' → cleanup; the finally is a
  // belt-and-suspenders in case close throws mid-way.
  if (app) {
    await app.close().catch(() => {});
  }
  cleanup();
}
