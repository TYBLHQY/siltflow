import {
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
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
  `);
  return db;
}

/**
 * Seed a document into the vault: copy `pdfPath` to `<vault>/documents/<id>.pdf`
 * and insert a `documents` row (matching the app's schema) so the doc shows up
 * in the tree and opens in the viewer via `siltflow://documents/<id>.pdf`.
 */
export function seedDocument(vault: string, pdfPath: string) {
  const id = randomUUID();
  const docsDir = path.join(vault, "documents");
  if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });
  copyFileSync(pdfPath, path.join(docsDir, `${id}.pdf`));

  const db = openVaultDb(vault);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO documents (id, title, original_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, "E2E Test PDF", path.basename(pdfPath), now, now);
  db.close();
  return id;
}

/**
 * Seed an annotation into the vault DB for a document. `position` is a
 * ScaledPosition (library format) with a pageNumber in the 1..N range.
 */
export function seedAnnotation(
  vault: string,
  documentId: string,
  annotation: {
    id: string;
    pageNumber: number;
    text: string;
    position: unknown;
  },
) {
  const db = openVaultDb(vault);
  const now = new Date().toISOString();
  const embedData = JSON.stringify({
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
