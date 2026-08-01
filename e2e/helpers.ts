import {
  _electron as electron,
  expect,
  type ElectronApplication,
} from "@playwright/test";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, "..");
const ELECTRON_BINARY = path.join(
  PROJECT_ROOT,
  "node_modules",
  "electron",
  "dist",
  "electron",
);
const MAIN_SCRIPT = path.join(PROJECT_ROOT, "dist-electron", "main.js");

export interface LaunchedApp {
  app: ElectronApplication;
  window: Awaited<ReturnType<ElectronApplication["firstWindow"]>>;
  vault: string;
  profile: string;
}

/** Open the vault DB, creating the app's tables if they don't exist yet. */
function openVaultDb(vault: string): Database.Database {
  const dbPath = path.join(vault, ".siltflow", "data.db");
  const db = new Database(dbPath);
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
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT NOT NULL,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      text TEXT,
      page_number INTEGER,
      embed_data TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'annotation',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (id, document_id)
    );
    CREATE TABLE IF NOT EXISTS summaries (
      document_id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      is_ai_generated INTEGER NOT NULL DEFAULT 0,
      source_lang TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

/**
 * Seed a document into the vault: copy `pdfPath` to `<vault>/documents/<id>.pdf`
 * and insert a `documents` row (matching the app's schema) so the doc shows up
 * in the tree and opens in the viewer via `siltflow://documents/<id>.pdf`.
 */
export function seedDocument(
  vault: string,
  pdfPath: string,
  title = "E2E Test PDF",
) {
  const id = randomUUID();
  const docsDir = path.join(vault, "documents");
  if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });
  copyFileSync(pdfPath, path.join(docsDir, `${id}.pdf`));

  const db = openVaultDb(vault);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO documents (id, title, original_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, title, path.basename(pdfPath), now, now);
  db.close();
  return id;
}

/**
 * Seed N documents from the same PDF in one DB round-trip, returning their
 * IDs in order. Used by multi-document tests (e.g. cross-document search).
 */
export function seedDocumentMulti(
  vault: string,
  pdfPath: string,
  titles: string[],
): string[] {
  const docsDir = path.join(vault, "documents");
  if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });

  const ids: string[] = [];
  const db = openVaultDb(vault);
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT OR REPLACE INTO documents (id, title, original_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const title of titles) {
    const id = randomUUID();
    copyFileSync(pdfPath, path.join(docsDir, `${id}.pdf`));
    insert.run(id, title, path.basename(pdfPath), now, now);
    ids.push(id);
  }
  db.close();
  return ids;
}

/**
 * Seed a summary row so the Summary tab renders it without an AI call
 * (`loadSummariesFromVault` restores it on boot). `is_ai_generated` maps to
 * the schema's integer boolean.
 */
export function seedSummary(
  vault: string,
  documentId: string,
  text: string,
  isAiGenerated = true,
  sourceLang = "en-US",
) {
  const db = openVaultDb(vault);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO summaries
       (document_id, text, is_ai_generated, source_lang, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(documentId, text, isAiGenerated ? 1 : 0, sourceLang, now, now);
  db.close();
}

/**
 * Build a ScaledPosition (react-pdf-highlighter-plus format) spanning a
 * horizontal band on one page. Only meaningful for text annotations, which
 * the viewer renders as a highlight overlay; coordinates are in the fixture's
 * PDF user space (612 × 792 pts — US Letter).
 */
export function makePosition(
  pageNumber: number,
  opts: {
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    width?: number;
    height?: number;
  } = {},
) {
  const {
    x1 = 50,
    y1 = 100,
    x2 = 300,
    y2 = 120,
    width = 612,
    height = 792,
  } = opts;
  return {
    boundingRect: { x1, y1, x2, y2, width, height, pageNumber },
    rects: [{ x1, y1, x2, y2, width, height, pageNumber }],
    usePdfCoordinates: false,
  };
}

/**
 * Seed an annotation into the vault DB for a document. `position` is a
 * ScaledPosition (library format) with a pageNumber in the 1..N range.
 * `embedData` (if provided) is stored verbatim; otherwise it's derived from
 * `position` + `text` — callers wanting a full custom embed (e.g. an AI
 * result attached) can pass `embedData`.
 */
export function seedAnnotation(
  vault: string,
  documentId: string,
  annotation: {
    id: string;
    pageNumber: number;
    text: string;
    position: unknown;
    embedData?: unknown;
  },
) {
  const db = openVaultDb(vault);
  const now = new Date().toISOString();
  const embedData =
    annotation.embedData ??
    JSON.stringify({
      position: annotation.position,
      content: { text: annotation.text },
    });
  db.prepare(
    `INSERT OR REPLACE INTO annotations
       (id, document_id, type, text, page_number, embed_data, kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    annotation.id,
    documentId,
    "text",
    annotation.text,
    annotation.pageNumber,
    embedData,
    "annotation",
    now,
    now,
  );
  db.close();
}

/**
 * Launch the built Electron app against an isolated temp vault + profile so
 * each test starts from a clean slate and boots straight into the main UI
 * (a pre-seeded `vault-path.json` under `--user-data-dir` skips the
 * VaultSetup screen).
 *
 * `seed(vault)` runs after the temp vault is created but BEFORE the app
 * launches, so DB rows / files are in place for the app's initial load.
 *
 * Requires `dist/` and `dist-electron/` to be built first (`pnpm build` or
 * `pnpm exec vite build`).
 */
export async function launchApp(
  seed?: (vault: string) => void,
): Promise<LaunchedApp> {
  const vault = mkdtempSync(path.join(tmpdir(), "siltflow-vault-"));
  mkdirSync(path.join(vault, "documents"), { recursive: true });
  mkdirSync(path.join(vault, ".siltflow"), { recursive: true });

  // Pre-seed before launch so the app's initial document/annotation load
  // sees the rows. seedDocument/seedAnnotation create the DB if missing.
  seed?.(vault);

  // Disable the startup update check for every test — otherwise, in
  // production builds, the app opens an "Update Available" dialog ~1.5s after
  // boot that overlays the UI and intercepts clicks (Electron E2E runs against
  // the built app, where checkUpdateOnStartup defaults to true). Merge so a
  // test's own config seed (e.g. lastPages) isn't clobbered.
  const cfgPath = path.join(vault, ".siltflow", "config.json");
  let cfg: Record<string, unknown> = {};
  try {
    cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
  } catch {
    /* fresh vault — no config yet */
  }
  cfg.appSettings = {
    ...(cfg.appSettings as object | undefined),
    checkUpdateOnStartup: false,
  };
  writeFileSync(cfgPath, JSON.stringify(cfg));

  const profile = mkdtempSync(path.join(tmpdir(), "siltflow-profile-"));
  writeFileSync(
    path.join(profile, "vault-path.json"),
    JSON.stringify({ vaultPath: vault }),
  );

  const app = await electron.launch({
    executablePath: ELECTRON_BINARY,
    args: [MAIN_SCRIPT, `--user-data-dir=${profile}`],
    env: { ...process.env, NODE_ENV: "production" },
    timeout: 45_000,
  });

  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded", { timeout: 30_000 });
  // Wait for the main 3-pane UI (past VaultSetup).
  await window.waitForSelector(".split-view", { timeout: 30_000 });

  return { app, window, vault, profile };
}

/**
 * Open a document by title: switch to the Docs tab and click its tree node.
 * `documents` (folder path) opens a folder, or a plain title matches a root doc.
 */
export async function openDocument(
  window: Awaited<ReturnType<ElectronApplication["firstWindow"]>>,
  title: string,
) {
  await window.getByRole("tab", { name: "Docs" }).click();
  const node = window.locator(`[title="${title}"]`).first();
  await expect(node).toBeVisible({ timeout: 20_000 });
  await node.click();
}

/**
 * Wait until the PDF viewer is mounted AND at least one page is rendered.
 * Use this before asserting on page geometry / text-layer DOM.
 */
export async function waitForPdf(
  window: Awaited<ReturnType<ElectronApplication["firstWindow"]>>,
) {
  await window.waitForSelector(".PdfHighlighter", { timeout: 30_000 });
  await window.waitForSelector(".pdfViewer .page", { timeout: 30_000 });
}
