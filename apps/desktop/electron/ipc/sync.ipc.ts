/**
 * Sync IPC handlers — expose sync operations to the renderer process.
 *
 * Channels:
 *   sync:getState      — returns current SyncState
 *   sync:syncNow       — triggers a full push-then-pull cycle
 *   sync:configure     — saves sync config to vault config
 *   sync:bootstrap     — bootstraps a new device on the sync server
 *   sync:getConflicts  — returns unresolved conflicts
 *   sync:resolveConflict — resolves a conflict (local|remote)
 *
 * The sync engine is initialized lazily — the main process calls
 * initSyncEngine() after the database is ready and sync config is loaded.
 */

import { ipcMain } from "electron";
import { getSqlite } from "../database";
import { SyncClient, SyncClientError } from "../sync/sync-client";
import { SyncWsClient } from "../sync/ws-client";
import { SyncEngine } from "../sync/sync-engine";
import type { SyncState, SyncConfig } from "@siltflow/shared-lib";

let engine: SyncEngine | null = null;
let wsClient: SyncWsClient | null = null;
let syncTimer: ReturnType<typeof setInterval> | null = null;
let config: SyncConfig = {
  serverUrl: "",
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

/**
 * Initialize the sync subsystem. Call this after the database is ready
 * and config has been loaded from the vault.
 */
export function initSyncEngine(cfg: SyncConfig, onStateChange?: (state: SyncState) => void): void {
  config = { ...cfg };
  teardownSyncEngine();

  if (!cfg.syncEnabled || !cfg.serverUrl || !cfg.deviceToken) return;

  const sql = getSqlite();
  if (!sql) {
    console.warn("[Sync] Database not ready, skipping sync init");
    return;
  }

  const client = new SyncClient(cfg.serverUrl, cfg.deviceToken);

  // WebSocket URL: replace http(s):// with ws(s):// and append /ws
  const wsUrl = cfg.serverUrl
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:") + "/ws";

  wsClient = new SyncWsClient(wsUrl, cfg.deviceToken);
  wsClient.on("sync:available", () => {
    // On remote change notification, do a quick pull
    engine?.pull().catch((err) => {
      console.warn("[Sync] Pull after notification failed:", (err as Error).message);
    });
  });
  wsClient.on("error", (err) => {
    console.warn("[Sync] WebSocket error:", err.message);
  });
  wsClient.connect();

  engine = new SyncEngine(client, wsClient, sql);

  if (onStateChange) {
    engine.on("state-change", onStateChange);
  }

  engine.on("error", (err) => {
    console.error("[Sync] Engine error:", (err as Error).message);
  });

  engine.on("conflicts", (conflicts) => {
    console.log(`[Sync] ${conflicts.length} conflict(s) detected`);
  });

  // Periodic sync timer
  if (cfg.syncIntervalMinutes > 0) {
    syncTimer = setInterval(() => {
      engine?.sync().catch((err) => {
        console.warn("[Sync] Periodic sync failed:", (err as Error).message);
      });
    }, cfg.syncIntervalMinutes * 60_000);
  }

  console.log(`[Sync] Initialized — server=${cfg.serverUrl}, interval=${cfg.syncIntervalMinutes}min`);
}

/** Tear down the sync subsystem (e.g. when config changes). */
export function teardownSyncEngine(): void {
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
    // Persist to vault config so it survives restart
    // Dynamic require avoids circular dependency since main.ts imports this module
    const main = require("../main");
    const vaultPath: string = main.getVaultPath();
    if (vaultPath) {
      main.writeVaultConfig(vaultPath, {
        syncEnabled: cfg.syncEnabled,
        syncServerUrl: cfg.serverUrl,
        syncDeviceToken: cfg.deviceToken,
        syncDeviceId: cfg.deviceId,
        syncIntervalMinutes: cfg.syncIntervalMinutes,
      });
    }

    initSyncEngine(cfg, (state) => {
      // Forward state changes to the renderer
      const { BrowserWindow } = require("electron");
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.webContents.send("sync:stateChange", state);
    });

    // Run initial sync immediately after connecting
    if (engine) {
      engine.sync().catch((err: Error) => {
        console.warn("[Sync] Initial sync failed:", err.message);
      });
    }
  });

  ipcMain.handle(
    "sync:bootstrap",
    async (_event, serverUrl: string, deviceName: string) => {
      const client = new SyncClient(serverUrl, "");
      try {
        // Try to bootstrap (only works if no devices exist on server)
        const result = await client.authBootstrap({
          deviceName: deviceName || "Desktop",
        });
        return result;
      } catch (bootstrapErr) {
        // If server already has devices (409), return a structured result
        // so the UI can prompt for an admin token instead of showing an error
        if (bootstrapErr instanceof SyncClientError && bootstrapErr.status === 409) {
          return { needsAdminToken: true, error: bootstrapErr.message };
        }
        throw bootstrapErr;
      }
    },
  );

  ipcMain.handle(
    "sync:registerWithToken",
    async (_event, serverUrl: string, adminToken: string, deviceName: string) => {
      const client = new SyncClient(serverUrl, adminToken);
      return client.authRegister({ deviceName });
    },
  );

  ipcMain.handle(
    "sync:verifyToken",
    async (_event, serverUrl: string, token: string) => {
      const client = new SyncClient(serverUrl, token);
      return client.authVerify();
    },
  );

  ipcMain.handle("sync:getConflicts", () => {
    if (!engine) return [];
    return engine.getConflicts();
  });

  ipcMain.handle(
    "sync:resolveConflict",
    async (_event, id: number, resolution: "local" | "remote") => {
      if (!engine) throw new Error("Sync is not configured");
      engine.resolveConflict(id, resolution);
    },
  );
}
