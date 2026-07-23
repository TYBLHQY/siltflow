import {
  app,
  BrowserWindow,
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
import {
  registerSyncHandlers,
  initSyncEngine,
} from "./ipc/sync.ipc";
import type { SyncConfig } from "@siltflow/shared-lib";

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

export function getVaultPath(): string {
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

export function writeVaultConfig(vaultPath: string, config: Record<string, unknown>) {
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
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "bottom" });
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
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
  registerSyncHandlers();

  // Initialize sync engine if configured
  const vaultCfg = readVaultConfig(vaultPath);
  if (vaultCfg.syncEnabled) {
    const syncCfg: SyncConfig = {
      serverUrl: (vaultCfg.syncServerUrl as string) ?? "",
      deviceToken: (vaultCfg.syncDeviceToken as string) ?? "",
      deviceId: (vaultCfg.syncDeviceId as string) ?? "",
      syncEnabled: true,
      syncIntervalMinutes: (vaultCfg.syncIntervalMinutes as number) ?? 5,
    };
    initSyncEngine(syncCfg, (state) => {
      win?.webContents.send("sync:stateChange", state);
    });
  }
}

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

  // Build folder path → folderId map, creating DB folders parent-first
  const sql = getSqlite();
  if (!sql) return null;

  const folderPathToId = new Map<string, string>();
  const insertFolder = sql.prepare(
    `INSERT INTO folders (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`,
  );
  const insertDoc = sql.prepare(
    `INSERT INTO documents (id, title, original_name, folder_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)`,
  );

  // Create root folder named after the imported directory
  const rootFolderId = crypto.randomUUID();
  insertFolder.run(rootFolderId, rootName, null, now, now);
  folderPathToId.set("", rootFolderId);

  function ensureFolder(relativeDir: string): string | null {
    if (relativeDir === "") return rootFolderId;
    const existing = folderPathToId.get(relativeDir);
    if (existing) return existing;

    const parentRel = path.dirname(relativeDir);
    const parentId = ensureFolder(parentRel === "." ? "" : parentRel);
    const folderId = crypto.randomUUID();
    const folderName = path.basename(relativeDir);

    insertFolder.run(folderId, folderName, parentId, now, now);
    folderPathToId.set(relativeDir, folderId);
    return folderId;
  }

  const importedDocs: { id: string; title: string; folderId: string | null }[] =
    [];

  for (const dirEntry of dirs) {
    const folderId = ensureFolder(dirEntry.relativeDir);

    for (const srcPath of dirEntry.pdfFiles) {
      const originalName = path.basename(srcPath);
      const docId = crypto.randomUUID();
      const dest = path.join(vaultPath, "documents", `${docId}.pdf`);

      try {
        fs.copyFileSync(srcPath, dest);

        insertDoc.run(
          docId,
          originalName.replace(/\.pdf$/i, ""),
          originalName,
          folderId,
          now,
          now,
        );

        importedDocs.push({
          id: docId,
          title: originalName.replace(/\.pdf$/i, ""),
          folderId,
        });
      } catch (err) {
        console.error(`Failed to import ${srcPath}:`, err);
      }
    }
  }

  return { docs: importedDocs };
});

// Custom protocol → serve files from vault
ipcMain.handle("file:load", async (_event, filePath: string) => {
  return fs.readFileSync(filePath).buffer;
});

// ── Auto-update ────────────────────────────────────────────────────
autoUpdater.autoDownload = false;
autoUpdater.forceDevUpdateConfig = true;
autoUpdater.fullChangelog = true;
autoUpdater.logger = null;

function sendUpdateEvent(channel: string, data: unknown) {
  win?.webContents.send(channel, data);
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
  autoUpdater.downloadUpdate();
});

ipcMain.handle("update:install", async () => {
  win?.destroy();
  autoUpdater.quitAndInstall();
});

// Open external URL in system browser
ipcMain.handle("shell:openExternal", async (_event, url: string) => {
  shell.openExternal(url);
});

// Expose the DB schema version to the renderer so About can display it
ipcMain.handle("db:schemaVersion", () => {
  const sql = getSqlite();
  if (!sql) return null;
  return sql.pragma("user_version", { simple: true }) as number;
});

// ── App Bootstrap ─────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Initialize database and register IPC handlers if vault is set
  const vaultPath = getVaultPath();
  if (vaultPath) {
    registerAllHandlers(vaultPath);
  }

  // Register siltflow:// protocol → vault path
  // Direct file read with proper Range header support (avoids net.fetch(file://) round-trip)
  protocol.handle("siltflow", (request) => {
    let relativePath = decodeURIComponent(
      request.url.slice("siltflow://".length),
    );
    if (relativePath.startsWith("/")) relativePath = relativePath.slice(1);
    const vault = getVaultPath();
    if (!vault) return new Response("Vault not set", { status: 404 });
    const fullPath = path.resolve(vault, relativePath);

    let raw: Buffer;
    try {
      raw = fs.readFileSync(fullPath);
    } catch {
      return new Response("File not found", { status: 404 });
    }

    const data = raw.buffer.slice(
      raw.byteOffset,
      raw.byteOffset + raw.byteLength,
    ) as ArrayBuffer;

    // Common CORS + PDF headers for all responses
    const baseHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/pdf",
      "Accept-Ranges": "bytes",
      "Content-Length": String(data.byteLength),
    };

    // Handle HTTP Range requests (pdfjs-dist uses partial range requests per page)
    const rangeHeader = request.headers.get("Range");
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : data.byteLength - 1;
        const chunk = data.slice(start, end + 1);
        return new Response(chunk, {
          status: 206,
          headers: {
            ...baseHeaders,
            "Content-Range": `bytes ${start}-${end}/${data.byteLength}`,
            "Content-Length": String(chunk.byteLength),
          },
        });
      }
    }

    return new Response(data, {
      headers: baseHeaders,
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
  createWindow();
});
