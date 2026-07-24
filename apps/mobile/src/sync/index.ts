/**
 * Sync module — lifecycle management for the mobile sync subsystem.
 *
 * initSyncEngine() creates the SyncClient, SyncWsClient, and SyncEngine
 * and starts periodic sync. teardownSyncEngine() stops everything.
 *
 * This is the mobile equivalent of desktop's electron/ipc/sync.ipc.ts
 * lifecycle hooks, but without Electron IPC — everything runs in the
 * React Native JS thread.
 *
 * Adapted from apps/desktop/electron/ipc/sync.ipc.ts
 */

import type { SyncState, SyncConfig } from "@siltflow/shared-lib";
import { SyncClient } from "./sync-client";
import { SyncWsClient } from "./ws-client";
import { SyncEngine } from "./sync-engine";
import { initChangelogTable } from "./changelog";

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

// ── Public API ──────────────────────────────────────────────────────

export function getSyncEngine(): SyncEngine | null {
  return engine;
}

export function getSyncConfig(): SyncConfig {
  return { ...config };
}

/** 本地数据变更后请求防抖推送。多次快速调用只在最后一次调用后 2 秒触发一次 pushIncremental()。 */
export function requestDeferredPush(): void {
  const eng = getSyncEngine();
  if (!eng) return;

  if (deferredPushTimer) clearTimeout(deferredPushTimer);
  deferredPushTimer = setTimeout(() => {
    deferredPushTimer = null;
    eng.pushIncremental().catch((err) => {
      console.warn("[Sync] Deferred push failed:", (err as Error).message);
    });
  }, DEFERRED_PUSH_MS);
}

/**
 * Initialize the sync subsystem. Call after the database is ready.
 */
export function initSyncEngine(
  cfg: SyncConfig,
  onStateChange?: (state: SyncState) => void,
): void {
  config = { ...cfg };
  teardownSyncEngine();

  if (!cfg.syncEnabled || !cfg.serverUrl || !cfg.deviceToken) return;

  // Ensure changelog table exists
  initChangelogTable();

  const client = new SyncClient(cfg.serverUrl, cfg.serverToken, cfg.deviceToken);

  // WebSocket URL: replace http(s):// with ws(s):// and append /ws
  const wsUrl =
    cfg.serverUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:") + "/ws";

  wsClient = new SyncWsClient(wsUrl, cfg.deviceToken);
  wsClient.onSyncAvailable(() => {
    engine?.pull().catch((err) => {
      console.warn(
        "[Sync] Pull after notification failed:",
        (err as Error).message,
      );
    });
  });
  wsClient.onError((err) => {
    console.warn("[Sync] WebSocket error:", err.message);
  });
  wsClient.connect();

  engine = new SyncEngine(client, wsClient);

  // Restore persisted timestamps
  // These are set by SyncProvider after reading from AsyncStorage
  // We set them to null here; SyncProvider will update them.

  if (onStateChange) {
    engine.onStateChange(onStateChange);
  }

  engine.onError((err) => {
    console.error("[Sync] Engine error:", (err as Error).message);
  });

  engine.onConflicts((conflicts) => {
    console.log(`[Sync] ${conflicts.length} conflict(s) detected`);
  });

  if (cfg.syncIntervalMinutes > 0) {
    syncTimer = setInterval(() => {
      engine?.sync().catch((err) => {
        console.warn(
          "[Sync] Periodic sync failed:",
          (err as Error).message,
        );
      });
    }, cfg.syncIntervalMinutes * 60_000);
  }

  // Run an initial full sync on startup to seed the local database
  engine.pushFull().then(() => engine?.pull()).catch((err) => {
    console.warn("[Sync] Initial full sync failed:", (err as Error).message);
  });

  console.log(
    `[Sync] Initialized — server=${cfg.serverUrl}, interval=${cfg.syncIntervalMinutes}min`,
  );
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
    // Clear callbacks (simple: reassign arrays)
    engine = null;
  }
}

/** Set engine timestamps from persisted state (called after init). */
export function setSyncTimestamps(
  lastPushAt: string | null,
  lastPullAt: string | null,
): void {
  if (engine) {
    engine.lastPushAt = lastPushAt;
    engine.lastPullAt = lastPullAt;
  }
}
