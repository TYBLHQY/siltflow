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
import { initOpLogTable } from "./op-log";
import { useToastStore } from "@/stores/toast.store";

// Deduplicate sync error toasts — same message within 30s shows once.
let lastNetworkErrorToast = 0;
const NETWORK_TOAST_DEDUPE_MS = 30_000;
const NETWORK_ERROR_LIST = ["fetch failed", "Network request failed", "timeout"];

function isNetworkErr(msg: string): boolean {
  const lower = msg.toLowerCase();
  return NETWORK_ERROR_LIST.some((p) => lower.includes(p.toLowerCase()));
}

function toastError(tag: string, msg: string): void {
  if (isNetworkErr(msg)) {
    const now = Date.now();
    if (now - lastNetworkErrorToast < NETWORK_TOAST_DEDUPE_MS) return;
    lastNetworkErrorToast = now;
    useToastStore.getState().pushToast("Sync: unable to reach server", "error");
  } else {
    useToastStore.getState().pushToast(`Sync: ${msg}`, "error");
  }
}

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

/** 本地数据变更后请求防抖推送。多次快速调用只在最后一次调用后 2 秒触发一次 pushOpLog()。 */
export function requestDeferredPush(): void {
  const eng = getSyncEngine();
  if (!eng) return;

  if (deferredPushTimer) clearTimeout(deferredPushTimer);
  deferredPushTimer = setTimeout(() => {
    deferredPushTimer = null;
    eng.pushOpLog().catch((err) => {
      const msg = (err as Error).message;
      console.warn("[Sync] Deferred push failed:", msg);
      toastError("push", msg);
    });
  }, DEFERRED_PUSH_MS);
}

export interface SyncInitOptions {
  /** Called whenever sync state changes. */
  onStateChange?: (state: SyncState) => void;
  /**
   * Pre-set timestamps from persisted storage. Must be set BEFORE engine
   * construction so the initial sync uses the correct incremental window
   * instead of fetching all data since epoch.
   */
  lastPushAt?: string | null;
  lastPullAt?: string | null;
  /**
   * When true, initSyncEngine skips the automatic initial sync() call.
   * The caller is responsible for seeding data (e.g. via runInitialFullSync).
   * Used by registerDevice to avoid concurrent syncs during first-time setup.
   */
  skipInitialSync?: boolean;
}

/**
 * Initialize the sync subsystem. Call after the database is ready.
 *
 * On normal app restart the engine runs an incremental sync
 * (pushOpLog + pull) — matching the desktop behaviour.
 * pushFull is replaced by seedOpLogFromExisting + pushOpLog for the
 * initial seed after a fresh device registration.
 */
export function initSyncEngine(
  cfg: SyncConfig,
  options?: SyncInitOptions,
): void {
  config = { ...cfg };
  teardownSyncEngine();

  if (!cfg.syncEnabled || !cfg.serverUrl || !cfg.deviceToken) return;

  // Ensure op_log table exists
  initOpLogTable();

  const client = new SyncClient(cfg.serverUrl, cfg.serverToken, cfg.deviceToken);

  // WebSocket URL: replace http(s):// with ws(s):// and append /ws
  const wsUrl =
    cfg.serverUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:") + "/ws";

  wsClient = new SyncWsClient(wsUrl, cfg.deviceToken);
  wsClient.onSyncAvailable(() => {
    engine?.pull().catch((err) => {
      const msg = (err as Error).message;
      console.warn(
        "[Sync] Pull after notification failed:",
        msg,
      );
      toastError("pull", msg);
    });
  });
  wsClient.onError((err) => {
    console.warn("[Sync] WebSocket error:", err.message);
    toastError("ws", err.message);
  });
  wsClient.connect();

  engine = new SyncEngine(client, wsClient);

  // Apply persisted timestamps BEFORE any sync runs so the engine
  // uses the correct incremental window from t=0.
  if (options?.lastPushAt) engine.lastPushAt = options.lastPushAt;
  if (options?.lastPullAt) engine.lastPullAt = options.lastPullAt;

  if (options?.onStateChange) {
    engine.onStateChange(options.onStateChange);
  }

  engine.onError((err) => {
    const msg = (err as Error).message;
    console.error("[Sync] Engine error:", msg);
    toastError("engine", msg);
  });

  if (cfg.syncIntervalMinutes > 0) {
    syncTimer = setInterval(() => {
      engine?.sync().catch((err) => {
        const msg = (err as Error).message;
        console.warn(
          "[Sync] Periodic sync failed:",
          msg,
        );
        toastError("sync", msg);
      });
    }, cfg.syncIntervalMinutes * 60_000);
  }

  // Run an initial incremental sync on startup — matching the desktop
  // behaviour. seedOpLogFromExisting + pushOpLog handles the first-sync
  // case (empty op_log, no lastPushAt) automatically.
  // When skipInitialSync is true the caller is responsible for the
  // first sync (e.g. registerDevice runs runInitialFullSync instead).
  if (!options?.skipInitialSync) {
    console.log("[Sync] initSyncEngine — running initial incremental sync, lastPushAt:", options?.lastPushAt, "lastPullAt:", options?.lastPullAt);
    engine.sync().catch((err) => {
      const msg = (err as Error).message;
      console.warn("[Sync] Initial sync failed:", msg);
      toastError("init", msg);
    });
  } else {
    console.log("[Sync] initSyncEngine — skipping initial sync (caller will seed)");
  }

  console.log(
    `[Sync] Initialized — server=${cfg.serverUrl}, interval=${cfg.syncIntervalMinutes}min`,
  );
}

/**
 * Run a full initial sync (seed + pushOpLog + pull) to seed a freshly
 * registered device's database. Only called once after registration;
 * normal restarts use the incremental sync inside initSyncEngine.
 *
 * IMPORTANT: pushOpLog sends all local rows to the server which triggers
 * a "sync:available" WebSocket broadcast. The other device receives that
 * broadcast and auto-pulls. To avoid racing with our own pull(), we
 * delay the pull briefly to let the auto-pull finish first.
 */
export async function runInitialFullSync(): Promise<void> {
  if (!engine) {
    console.warn("[Sync] Cannot run initial full sync — engine not initialised");
    return;
  }
  try {
    console.log("[Sync] runInitialFullSync — seeding op_log + pushOpLog");
    engine.seedOpLogFromExisting();
    await engine.pushOpLog();
    // Small delay to let the WebSocket-triggered auto-pull finish
    // before we do our own pull.
    await new Promise((r) => setTimeout(r, 500));
    console.log("[Sync] runInitialFullSync — starting pull");
    await engine.pull();
    console.log("[Sync] Initial full sync complete");
  } catch (err) {
    const msg = (err as Error).message;
    console.warn("[Sync] Initial full sync failed:", msg);
    toastError("seed", msg);
  }
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
    engine = null;
  }
}
