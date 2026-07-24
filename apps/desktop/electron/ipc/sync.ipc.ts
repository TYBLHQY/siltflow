/**
 * Sync IPC handlers — expose sync operations to the renderer process.
 *
 * Channels:
 *   sync:getState        — returns current SyncState
 *   sync:syncNow         — triggers a full push-then-pull cycle
 *   sync:configure       — saves sync config to vault config + starts engine
 *   sync:register        — registers a device with the server (uses server token)
 *   sync:disconnect      — tears down sync engine and clears persisted config
 *
 * The sync engine is initialized lazily — the main process calls
 * initSyncEngine() after the database is ready and sync config is loaded.
 */

import { ipcMain } from "electron";
import { getSqlite } from "../database";
import { SyncClient } from "../sync/sync-client";
import { SyncWsClient } from "../sync/ws-client";
import { SyncEngine } from "../sync/sync-engine";
import type { SyncState, SyncConfig } from "@siltflow/shared-lib";

let engine: SyncEngine | null = null;
let wsClient: SyncWsClient | null = null;
let syncTimer: ReturnType<typeof setInterval> | null = null;
let deferredPushTimer: ReturnType<typeof setTimeout> | null = null;
const DEFERRED_PUSH_MS = 2000;
let config: SyncConfig = {
  serverUrl: "",
  serverToken: "",
  deviceToken: "",
  deviceId: "",
  syncEnabled: false,
  syncIntervalMinutes: 5,
};

// ── Public API for main.ts ──────────────────────────────────────────

export function getSyncEngine(): SyncEngine | null {
  return engine;
}

export function getSyncConfig(): SyncConfig {
  return { ...config };
}

/** Request a debounced push of local changes. Safe to call after every local write. */
export function requestDeferredPush(): void {
  if (!engine) return;

  console.log("[Sync:Desktop] requestDeferredPush — scheduling push in", DEFERRED_PUSH_MS, "ms");
  if (deferredPushTimer) clearTimeout(deferredPushTimer);
  deferredPushTimer = setTimeout(() => {
    deferredPushTimer = null;
    console.log("[Sync:Desktop] deferredPush firing — running pushOpLog");
    engine?.pushOpLog().catch((err) => {
      console.warn("[Sync] Deferred push failed:", (err as Error).message);
    });
  }, DEFERRED_PUSH_MS);
}

/**
 * Initialize the sync subsystem. Call this after the database is ready
 * and config has been loaded from the vault.
 */
export function initSyncEngine(
  cfg: SyncConfig,
  options?: {
    onStateChange?: (state: SyncState) => void;
    /** Pre-set timestamps from persisted storage. Must be set BEFORE the
     *  engine runs its first sync so it uses the correct incremental
     *  window instead of fetching all data since epoch. */
    lastPushAt?: string | null;
    lastPullAt?: string | null;
  },
): void {
  config = { ...cfg };
  teardownSyncEngine();

  if (!cfg.syncEnabled || !cfg.serverUrl || !cfg.deviceToken) return;

  const sql = getSqlite();
  if (!sql) {
    console.warn("[Sync] Database not ready, skipping sync init");
    return;
  }

  const client = new SyncClient(cfg.serverUrl, cfg.serverToken, cfg.deviceToken);

  // WebSocket URL: replace http(s):// with ws(s):// and append /ws
  const wsUrl = cfg.serverUrl
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:") + "/ws";

  wsClient = new SyncWsClient(wsUrl, cfg.deviceToken);
  wsClient.on("sync:available", () => {
    console.log("[Sync:Desktop] WebSocket sync:available — triggering pull");
    engine?.pull().catch((err) => {
      console.warn("[Sync] Pull after notification failed:", (err as Error).message);
    });
  });
  wsClient.on("error", (err) => {
    console.warn("[Sync] WebSocket error:", err.message);
  });
  wsClient.connect();

  engine = new SyncEngine(client, wsClient, sql);

  // Apply persisted timestamps BEFORE any sync runs so the engine
  // uses the correct incremental window and never sends epoch→now.
  if (options?.lastPushAt) engine.lastPushAt = options.lastPushAt;
  if (options?.lastPullAt) engine.lastPullAt = options.lastPullAt;

  if (options?.onStateChange) {
    engine.on("state-change", options.onStateChange);
  }

  engine.on("error", (err) => {
    console.error("[Sync] Engine error:", (err as Error).message);
  });

  engine.on("error", (err) => {
    console.error("[Sync] Engine error:", (err as Error).message);
  });

  if (cfg.syncIntervalMinutes > 0) {
    syncTimer = setInterval(() => {
      engine?.sync().catch((err) => {
        console.warn("[Sync] Periodic sync failed:", (err as Error).message);
      });
    }, cfg.syncIntervalMinutes * 60_000);
  }

  // Run an immediate sync on startup
  console.log("[Sync:Desktop] initSyncEngine — running initial sync, lastPushAt:", options?.lastPushAt, "lastPullAt:", options?.lastPullAt);
  engine.sync().catch((err) => {
    console.warn("[Sync] Initial sync failed:", (err as Error).message);
  });

  console.log(`[Sync] Initialized — server=${cfg.serverUrl}, interval=${cfg.syncIntervalMinutes}min`);
}

/** Tear down the sync subsystem (e.g. when config changes). */
export function teardownSyncEngine(): void {
  if (deferredPushTimer) {
    clearTimeout(deferredPushTimer);
    deferredPushTimer = null;
  }
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }
  if (engine) {
    engine.removeAllListeners();
    engine = null;
  }
}

// ── IPC Handlers ────────────────────────────────────────────────────

export function registerSyncHandlers(): void {
  ipcMain.handle("sync:getState", () => {
    return engine?.state ?? null;
  });

  ipcMain.handle("sync:syncNow", async () => {
    if (!engine) throw new Error("Sync is not configured");
    await engine.sync();
  });

  ipcMain.handle("sync:configure", async (_event, cfg: SyncConfig) => {
    config = { ...cfg };
    // Persist to vault config
    const main = require("../main");
    const vaultPath: string = main.getVaultPath();
    if (vaultPath) {
      main.writeVaultConfig(vaultPath, {
        syncEnabled: cfg.syncEnabled,
        syncServerUrl: cfg.serverUrl,
        syncServerToken: cfg.serverToken,
        syncDeviceToken: cfg.deviceToken,
        syncDeviceId: cfg.deviceId,
        syncIntervalMinutes: cfg.syncIntervalMinutes,
      });
    }

    initSyncEngine(cfg, {
      onStateChange: (state) => {
        const { BrowserWindow } = require("electron");
        const win = BrowserWindow.getAllWindows()[0];
        if (win) win.webContents.send("sync:stateChange", state);
      },
    });

    if (engine) {
      engine.sync().catch((err: Error) => {
        console.warn("[Sync] Initial sync failed:", err.message);
      });
    }
  });

  ipcMain.handle(
    "sync:register",
    async (_event, serverUrl: string, serverToken: string, deviceName: string, deviceId?: string) => {
      const client = new SyncClient(serverUrl, serverToken, "");
      return client.authRegister({
        deviceName: deviceName || "Desktop",
        deviceId,
      });
    },
  );

  ipcMain.handle(
    "sync:verifyToken",
    async (_event, serverUrl: string, token: string) => {
      const client = new SyncClient(serverUrl, "", token);
      return client.authVerify();
    },
  );

  ipcMain.handle("sync:disconnect", async () => {
    teardownSyncEngine();

    // Clear persisted sync config from vault
    const main = require("../main");
    const vaultPath: string = main.getVaultPath();
    if (vaultPath) {
      main.writeVaultConfig(vaultPath, {
        syncEnabled: false,
        syncServerUrl: "",
        syncServerToken: "",
        syncDeviceToken: "",
        syncDeviceId: "",
        syncIntervalMinutes: 5,
        syncLastPushAt: "",
        syncLastPullAt: "",
      });
    }

    return { ok: true };
  });
}
