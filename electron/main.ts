import {
  app,
  BrowserWindow,
  clipboard,
  Menu,
  protocol,
  dialog,
  ipcMain,
  shell,
  session,
  globalShortcut,
} from "electron";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { autoUpdater } from "electron-updater";

import { initDatabase, getSqlite } from "./database";
import {
  registerDocumentHandlers,
  setVaultPathForDocuments,
} from "./ipc/documents.ipc";
import { registerAnnotationHandlers } from "./ipc/annotations.ipc";
import { registerSummaryHandlers } from "./ipc/summaries.ipc";
import { registerAiResultHandlers } from "./ipc/ai-results.ipc";
import { registerFSRSCardHandlers } from "./ipc/fsrs-cards.ipc";
import { registerTTSHandlers, setTtsCacheDir } from "./ipc/tts.ipc";
import {
  registerFolderHandlers,
  setVaultPathForFolders,
} from "./ipc/folders.ipc";
import { registerReviewLogHandlers } from "./ipc/review-logs.ipc";
import { registerReviewHandlers } from "./ipc/review.ipc";
import { parseDeepLinkUrl } from "./deep-link";

// Register siltflow:// as a privileged scheme BEFORE app.whenReady
protocol.registerSchemesAsPrivileged([
  {
    scheme: "siltflow",
    privileges: {
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// ── Deep links (siltflow://open/<documentId>) ─────────────────────
// External links launch a second app instance carrying the URL in argv
// (Windows/Linux) or fire `open-url` (macOS). Enforce single-instance and
// forward the URL to the running window. The lock keys on the userData dir,
// so E2E instances with isolated --user-data-dir profiles don't collide.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();

app.on("second-instance", (_event, argv) => {
  for (const arg of argv) {
    if (arg.startsWith("siltflow://")) {
      handleDeepLink(arg);
      break;
    }
  }
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

// Disable GPU sandbox to suppress MESA-LOADER permission-denied warning
// when chrome-sandbox lacks SUID bit.  Only affects the GPU process —
// the renderer sandbox (more critical for security) remains active.
app.commandLine.appendSwitch("disable-gpu-sandbox");

// ── Vault Management ──────────────────────────────────────────────
const VAULT_CONFIG_DIR = app.getPath("userData");
const VAULT_POINTER_PATH = path.join(VAULT_CONFIG_DIR, "vault-path.json");

const SILTFLOW_DIR = ".siltflow";

function getVaultPath(): string {
  try {
    const data = JSON.parse(fs.readFileSync(VAULT_POINTER_PATH, "utf-8"));
    if (data.vaultPath && fs.existsSync(data.vaultPath)) {
      return data.vaultPath;
    }
  } catch {
    /* VAULT_POINTER_PATH not yet created */
  }
  return "";
}

function setVaultPath(vaultPath: string) {
  if (!fs.existsSync(VAULT_CONFIG_DIR)) {
    fs.mkdirSync(VAULT_CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(VAULT_POINTER_PATH, JSON.stringify({ vaultPath }, null, 2));
}

function vaultConfigPath(vaultPath: string): string {
  return path.join(vaultPath, SILTFLOW_DIR, "config.json");
}

function readVaultConfig(vaultPath: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(vaultConfigPath(vaultPath), "utf-8"));
  } catch {
    return {};
  }
}

function writeVaultConfig(vaultPath: string, config: Record<string, unknown>) {
  const p = vaultConfigPath(vaultPath);
  // Merge with existing config so we don't overwrite other keys
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    /* file doesn't exist yet */
  }
  if (!fs.existsSync(path.dirname(p))) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
  }
  fs.writeFileSync(p, JSON.stringify({ ...existing, ...config }, null, 2));
}

function ensureVaultStructure(vaultPath: string) {
  const dirs = [
    path.join(vaultPath, SILTFLOW_DIR),
    path.join(vaultPath, SILTFLOW_DIR, "tts-cache"),
    path.join(vaultPath, "documents"),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// ── Window Management ─────────────────────────────────────────────
let win: BrowserWindow | null;

// Single-slot stash for deep links that arrive before the renderer is ready
// to receive them (cold start, or a link landing between createWindow and the
// renderer subscribing). The renderer drains it via `deep-link:consume-pending`.
let pendingDeepLink: { documentId: string } | null = null;

async function installDevTools() {
  try {
    // Download + load React DevTools using Electron's own session API.
    // Bypasses electron-devtools-installer which breaks under Rolldown bundling
    // in ESM mode (CJS→ESM interop helper is dropped during dynamic import).
    const REACT_DEVTOOLS_ID = "fmkadmapgofadopljbjfkapdkoienihi";
    const extensionsStore = path.join(app.getPath("userData"), "extensions");
    const extDir = path.join(extensionsStore, REACT_DEVTOOLS_ID);

    if (!fs.existsSync(path.join(extDir, "manifest.json"))) {
      console.log("[DevTools] Downloading React Developer Tools…");
      if (!fs.existsSync(extensionsStore)) {
        fs.mkdirSync(extensionsStore, { recursive: true });
      }

      // CRXv3 is essentially a ZIP archive with a 4-byte magic header.
      // Strip the CRX header bytes and decompress the remainder.
      const { execFileSync } = await import("node:child_process");
      const crxPath = path.join(extensionsStore, `${REACT_DEVTOOLS_ID}.crx`);
      const url = `https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx3&x=id%3D${REACT_DEVTOOLS_ID}%26uc&prodversion=${process.versions.chrome}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(crxPath, buffer);

      // CRXv3 header: magic(4) + crx_version(4) + header_len(4) + header_data(header_len) + zip_data(rest)
      const magic = buffer.readUint32LE(0);
      if (magic === 0x34327243) {
        // 'Cr24' – CRXv3 header present
        const headerLen = buffer.readUint32LE(8);
        const zipStart = 12 + headerLen;
        const zipBuf = buffer.subarray(zipStart);
        fs.mkdirSync(extDir, { recursive: true });
        execFileSync("unzip", ["-o", "-d", extDir], { input: zipBuf });
      } else {
        // Already a plain zip or a newer CRX format
        execFileSync("unzip", ["-o", "-d", extDir, crxPath]);
      }

      fs.chmodSync(extDir, 0o755);
    }

    const ext = await session.defaultSession.extensions.loadExtension(extDir);
    console.log(
      `[DevTools] React Developer Tools loaded: ${ext.name} v${ext.version}`,
    );
  } catch (e) {
    console.log(
      "[DevTools] Could not install React DevTools:",
      (e as Error).message,
    );
  }
}

function createWindow() {
  Menu.setApplicationMenu(null);

  win = new BrowserWindow({
    icon: path.join(RENDERER_DIST, "icon.png"),
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  // Open external links in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    void void shell.openExternal(url);
    return { action: "deny" };
  });

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "bottom" });
  } else {
    void win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ── IPC Handlers ──────────────────────────────────────────────────

// Register IPC handlers once at module load time (safe to call multiple
// times — the inner flag prevents double registration).
let handlersRegistered = false;

function registerAllHandlers(vaultPath: string) {
  if (handlersRegistered) return;
  handlersRegistered = true;
  initDatabase(vaultPath);
  registerDocumentHandlers();
  setVaultPathForDocuments(vaultPath);
  registerAnnotationHandlers();
  registerSummaryHandlers();
  registerAiResultHandlers();
  registerFSRSCardHandlers();
  registerReviewLogHandlers();
  registerReviewHandlers();
  registerTTSHandlers();
  registerFolderHandlers();
  setVaultPathForFolders(vaultPath);
  setTtsCacheDir(path.join(vaultPath, ".siltflow", "tts-cache"));
}

// Deep links: drain the stashed payload (single slot, last link wins)
ipcMain.handle("deep-link:consume-pending", () => {
  const pending = pendingDeepLink;
  pendingDeepLink = null;
  return pending;
});

// Vault operations
ipcMain.handle("vault:getPath", () => {
  return getVaultPath();
});

ipcMain.handle("vault:select", async () => {
  if (!win) return "";
  const result = await dialog.showOpenDialog(win, {
    title: "Select Vault Directory",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return "";
  const vaultPath = result.filePaths[0];
  ensureVaultStructure(vaultPath);
  setVaultPath(vaultPath);
  if (!handlersRegistered) {
    registerAllHandlers(vaultPath);
  } else {
    initDatabase(vaultPath);
  }
  return vaultPath;
});

ipcMain.handle("vault:setPath", (_event, vaultPath: string) => {
  ensureVaultStructure(vaultPath);
  setVaultPath(vaultPath);
  if (!handlersRegistered) {
    registerAllHandlers(vaultPath);
  } else {
    initDatabase(vaultPath);
  }
  return vaultPath;
});

// Vault config (all user config lives in vault/.siltflow/config.json)
ipcMain.handle("vault:config:get", () => {
  const vault = getVaultPath();
  if (!vault) return {};
  return readVaultConfig(vault);
});

ipcMain.handle(
  "vault:config:set",
  (_event, config: Record<string, unknown>) => {
    const vault = getVaultPath();
    if (!vault) return;
    writeVaultConfig(vault, config);
  },
);

// Document import
ipcMain.handle("dialog:selectPdf", async () => {
  if (!win) return null;
  const vaultPath = getVaultPath();
  if (!vaultPath) return null;

  const result = await dialog.showOpenDialog(win, {
    title: "Select PDF",
    filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
    properties: ["openFile", "multiSelections"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  return result.filePaths.map((srcPath) => {
    const originalName = path.basename(srcPath);
    const docId = crypto.randomUUID();
    const dest = path.join(vaultPath, "documents", `${docId}.pdf`);

    fs.copyFileSync(srcPath, dest);

    return {
      id: docId,
      title: originalName.replace(/\.pdf$/i, ""),
    };
  });
});

// Import PDFs from a folder (recursive), mirroring directory structure as folders
ipcMain.handle("dialog:importPdfFolder", async () => {
  if (!win) return null;
  const vaultPath = getVaultPath();
  if (!vaultPath) return null;

  const result = await dialog.showOpenDialog(win, {
    title: "Import PDF Folder",
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const rootDir = result.filePaths[0];
  const rootName = path.basename(rootDir);
  const now = new Date().toISOString();

  // Walk directory recursively, collecting PDFs per relative directory
  interface DirEntry {
    relativeDir: string;
    pdfFiles: string[];
  }
  const dirs: DirEntry[] = [{ relativeDir: "", pdfFiles: [] }];
  const dirMap = new Map<string, DirEntry>();
  dirMap.set("", dirs[0]);

  function walk(dir: string, relativeDir: string) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        const dirEntry: DirEntry = { relativeDir: relPath, pdfFiles: [] };
        dirMap.set(relPath, dirEntry);
        dirs.push(dirEntry);
        walk(fullPath, relPath);
      } else if (entry.isFile() && /\.pdf$/i.test(entry.name)) {
        const parentEntry = dirMap.get(relativeDir)!;
        parentEntry.pdfFiles.push(fullPath);
      }
    }
  }
  walk(rootDir, "");

  // Build folder path → folderId map. Folder rows are NOT written here —
  // they're deferred into the Phase 2 transaction so the whole import is
  // atomic (a failure before COMMIT leaves no orphan folder rows).
  const sql = getSqlite();
  if (!sql) return null;

  const folderPathToId = new Map<string, string>();
  // Collect (relativeDir, name, parentId) in parent-first order for Phase 2.
  const folderRows: Array<{
    id: string;
    name: string;
    parentId: string | null;
  }> = [];
  const insertFolder = sql.prepare(
    `INSERT INTO folders (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`,
  );
  const insertDoc = sql.prepare(
    `INSERT INTO documents (id, title, original_name, folder_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)`,
  );

  // Create root folder named after the imported directory
  const rootFolderId = crypto.randomUUID();
  folderRows.push({ id: rootFolderId, name: rootName, parentId: null });
  folderPathToId.set("", rootFolderId);

  function ensureFolder(relativeDir: string): string | null {
    if (relativeDir === "") return rootFolderId;
    const existing = folderPathToId.get(relativeDir);
    if (existing) return existing;

    const parentRel = path.dirname(relativeDir);
    const parentId = ensureFolder(parentRel === "." ? "" : parentRel);
    const folderId = crypto.randomUUID();
    const folderName = path.basename(relativeDir);

    folderRows.push({ id: folderId, name: folderName, parentId });
    folderPathToId.set(relativeDir, folderId);
    return folderId;
  }

  const importedDocs: Array<{
    id: string;
    title: string;
    folderId: string | null;
  }> = [];

  // Phase 1 — copy all PDF files off the event loop (async, parallel).
  // Each entry carries its own docId + folderId so the DB phase never has to
  // re-derive ids (folder-relative names can repeat across directories).
  const fileCopies: Array<{
    srcPath: string;
    dest: string;
    docId: string;
    folderId: string | null;
    originalName: string;
  }> = [];
  for (const dirEntry of dirs) {
    const folderId = ensureFolder(dirEntry.relativeDir);
    for (const srcPath of dirEntry.pdfFiles) {
      const docId = crypto.randomUUID();
      const dest = path.join(vaultPath, "documents", `${docId}.pdf`);
      const originalName = path.basename(srcPath);
      fileCopies.push({ srcPath, dest, docId, folderId, originalName });
      importedDocs.push({
        id: docId,
        title: originalName.replace(/\.pdf$/i, ""),
        folderId,
      });
    }
  }

  // Best-effort removal of already-copied files on failure.
  const cleanupCopied = () =>
    Promise.all(
      fileCopies.map(({ dest }) => fs.promises.unlink(dest).catch(() => {})),
    );

  try {
    // Copy files concurrently (async, non-blocking). bail on first failure.
    await Promise.all(
      fileCopies.map(async ({ srcPath, dest }) => {
        await fs.promises.copyFile(srcPath, dest);
      }),
    );
  } catch (err) {
    // Roll back any files already copied so we don't leave orphans on disk.
    await cleanupCopied();
    console.error("Failed to import PDFs:", err);
    return { docs: [] };
  }

  // Phase 2 — write all folder/document rows in a single transaction so a
  // failure mid-write leaves no partially-imported library behind.
  sql.exec("BEGIN IMMEDIATE");
  try {
    // Folders parent-first (folderRows was pushed in that order).
    for (const f of folderRows) {
      insertFolder.run(f.id, f.name, f.parentId, now, now);
    }
    for (const file of fileCopies) {
      insertDoc.run(
        file.docId,
        file.originalName.replace(/\.pdf$/i, ""),
        file.originalName,
        file.folderId,
        now,
        now,
      );
    }
    sql.exec("COMMIT");
  } catch (err) {
    sql.exec("ROLLBACK");
    // Best-effort cleanup of copied files (DB rows were rolled back).
    await cleanupCopied();
    console.error("Failed to import PDF folder:", err);
    return { docs: [] };
  }

  return { docs: importedDocs };
});

// Custom protocol → serve files from vault
ipcMain.handle("file:load", async (_event, filePath: string) => {
  const buf = await fs.promises.readFile(filePath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
});

// ── Auto-update ────────────────────────────────────────────────────
autoUpdater.autoDownload = false;
autoUpdater.forceDevUpdateConfig = true;
autoUpdater.fullChangelog = true;
autoUpdater.logger = null;

function sendUpdateEvent(channel: string, data: unknown) {
  win?.webContents.send(channel, data);
}

// Route a siltflow:// deep link to the renderer. Always stash first, then ping
// if the window is live — the renderer pulls the payload with
// `deep-link:consume-pending`, which makes this exactly-once (no lost update if
// the renderer hasn't subscribed yet) and coalesces rapid links to the latest.
function handleDeepLink(url: string): void {
  const parsed = parseDeepLinkUrl(url);
  if (!parsed) return;
  pendingDeepLink = { documentId: parsed.documentId };
  if (
    win &&
    !win.isDestroyed() &&
    win.webContents &&
    !win.webContents.isDestroyed()
  ) {
    win.webContents.send("deep-link:available");
  }
}

autoUpdater.on("update-available", (info) => {
  sendUpdateEvent("update:available", {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseName: info.releaseName,
    releaseNotes: info.releaseNotes,
  });
});
autoUpdater.on("update-not-available", () => {
  sendUpdateEvent("update:not-available", null);
});
autoUpdater.on("download-progress", (progress) => {
  sendUpdateEvent("update:download-progress", progress);
});
autoUpdater.on("update-downloaded", () => {
  sendUpdateEvent("update:downloaded", null);
});
autoUpdater.on("error", (err) => {
  sendUpdateEvent("update:error", err.message);
});

ipcMain.handle("update:check", async () => {
  try {
    await autoUpdater.checkForUpdates();
  } catch (err: unknown) {
    sendUpdateEvent("update:error", (err as Error)?.message ?? String(err));
  }
});

ipcMain.handle("update:download", async () => {
  void autoUpdater.downloadUpdate();
});

ipcMain.handle("update:install", async () => {
  win?.destroy();
  autoUpdater.quitAndInstall();
});

// Open external URL in system browser
ipcMain.handle("shell:openExternal", async (_event, url: string) => {
  void shell.openExternal(url);
});

// Reveal a document's PDF file in the OS file manager (highlight selected)
ipcMain.handle("shell:showItemInFolder", (_event, docId: string) => {
  const vault = getVaultPath();
  if (!vault) return;
  shell.showItemInFolder(path.join(vault, "documents", `${docId}.pdf`));
});

// Read text from the system clipboard (used by the context-note paste button)
ipcMain.handle("clipboard:readText", () => clipboard.readText());

// Write text to the system clipboard (share button copies the deep-link URL)
ipcMain.handle("clipboard:writeText", (_event, text: string) => {
  clipboard.writeText(text);
});

// Expose the DB schema version to the renderer so About can display it
ipcMain.handle("db:schemaVersion", () => {
  const sql = getSqlite();
  if (!sql) return null;
  return sql.pragma("user_version", { simple: true }) as number;
});

// ── App Bootstrap ─────────────────────────────────────────────────
void app.whenReady().then(async () => {
  // Losing instance of the single-instance lock: app.quit() is async, so bail
  // here before any window/DB work runs in the process that's about to exit.
  if (!gotTheLock) return;

  // Initialize database and register IPC handlers if vault is set
  const vaultPath = getVaultPath();
  if (vaultPath) {
    registerAllHandlers(vaultPath);
  }

  // Register siltflow:// as the OS default protocol client so external
  // deep links (siltflow://open/<documentId>) launch the app. Dev and E2E run
  // the Electron binary directly (process.defaultApp), so pass the app path
  // explicitly; packaged builds register by scheme only.
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient("siltflow", process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient("siltflow");
  }

  // Register siltflow:// protocol → vault path
  // Direct file read with proper Range header support (avoids net.fetch(file://) round-trip)
  protocol.handle("siltflow", async (request) => {
    let relativePath = decodeURIComponent(
      request.url.slice("siltflow://".length),
    );
    if (relativePath.startsWith("/")) relativePath = relativePath.slice(1);
    const vault = getVaultPath();
    if (!vault) return new Response("Vault not set", { status: 404 });
    const fullPath = path.resolve(vault, relativePath);

    // Open the file once and read only the requested byte span, instead of
    // slurping the whole PDF into memory on every request. pdfjs-dist issues
    // one partial Range request per page — a full synchronous readFileSync
    // here would re-read the whole file (O(fileSize)) for every rendered page
    // and block the main-process event loop.
    let handle: Awaited<ReturnType<typeof fs.promises.open>>;
    try {
      handle = await fs.promises.open(fullPath, "r");
    } catch {
      return new Response("File not found", { status: 404 });
    }

    // Common CORS + PDF headers for all responses
    const baseHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/pdf",
      "Accept-Ranges": "bytes",
    };

    let size: number;
    try {
      size = (await handle.stat()).size;
    } catch {
      await handle.close();
      return new Response("File not found", { status: 404 });
    }
    if (size <= 0) {
      await handle.close();
      return new Response("Empty file", { status: 404 });
    }

    // Handle HTTP Range requests (pdfjs-dist uses partial range requests per
    // page): seek-read only the requested span from disk rather than reading
    // the entire file and slicing the buffer in memory.
    const rangeHeader = request.headers.get("Range");
    if (rangeHeader) {
      const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
      if (match) {
        const start = Number.parseInt(match[1], 10);
        const end = match[2] ? Number.parseInt(match[2], 10) : size - 1;
        if (start < 0 || start > size - 1 || end < start) {
          await handle.close();
          return new Response("Range Not Satisfiable", {
            status: 416,
            headers: { "Content-Range": `bytes */${size}` },
          });
        }
        const len = Math.min(end, size - 1) - start + 1;
        const buf = Buffer.allocUnsafe(len);
        try {
          const { bytesRead } = await handle.read(buf, 0, len, start);
          const chunk = new Uint8Array(buf.subarray(0, bytesRead));
          return new Response(chunk, {
            status: 206,
            headers: {
              ...baseHeaders,
              "Content-Range": `bytes ${start}-${start + bytesRead - 1}/${size}`,
              "Content-Length": String(bytesRead),
            },
          });
        } finally {
          await handle.close();
        }
      }
      // Malformed Range header → fall through to full-file response.
    }

    // No Range header: async read of the whole file. Rare after the initial
    // load (pdfjs switches to per-page Range requests once the document opens).
    const buf = await handle.readFile();
    await handle.close();
    const data = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    );
    return new Response(data, {
      headers: {
        ...baseHeaders,
        "Content-Length": String(data.byteLength),
      },
    });
  });

  if (VITE_DEV_SERVER_URL) {
    // Register F12 as a toggle shortcut since Menu.setApplicationMenu(null)
    // removes the menu bar and its default keyboard bindings.
    globalShortcut.register("F12", () => {
      win?.webContents.toggleDevTools();
    });

    await installDevTools();
  }

  // Cold start via a deep link: Windows/Linux put the URL in argv before we
  // reach here (macOS delivers it through `open-url` instead). Stash it now —
  // the renderer drains it once it mounts. Safe before createWindow because
  // handleDeepLink only writes the stash when the window isn't live yet.
  const deepLinkArg = process.argv.find((arg) => arg.startsWith("siltflow://"));
  if (deepLinkArg) handleDeepLink(deepLinkArg);

  createWindow();
});
