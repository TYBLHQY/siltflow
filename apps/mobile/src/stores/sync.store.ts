/**
 * Sync Zustand store — mirrors desktop `stores/sync.store.ts`.
 *
 * Provides sync state (config, status, conflicts) and actions
 * (registerDevice, syncNow, disconnect) to the React UI layer.
 *
 * Auth model (v2):
 *   serverToken — server-level secret, user enters once per server
 *   deviceToken — per-device secret, server returns on registration
 *   deviceId    — device identity, server returns on registration
 *
 * All config is persisted to the SQLite `app_settings` table so
 * restarting the mobile app reconnects without re-entering credentials.
 *
 * Adapted from apps/desktop/src/stores/sync.store.ts
 */

import { create } from "zustand";
import { getSQLite } from "@/stores/db.store";
import type { SyncState, SyncConfig } from "@siltflow/shared-lib";
import type { ConflictRecord } from "@/sync/sync-engine";
import { SyncClient } from "@/sync/sync-client";
import {
  initSyncEngine,
  teardownSyncEngine,
  getSyncEngine,
  runInitialFullSync,
} from "@/sync";

// ── Settings keys (used as key column in app_settings table) ────────

const KEYS = {
  syncEnabled: "sync:enabled",
  serverUrl: "sync:serverUrl",
  serverToken: "sync:serverToken",
  deviceToken: "sync:deviceToken",
  deviceId: "sync:deviceId",
  syncIntervalMinutes: "sync:intervalMinutes",
  lastPushAt: "sync:lastPushAt",
  lastPullAt: "sync:lastPullAt",
} as const;

const ALL_SYNC_KEYS = Object.values(KEYS);

// ── Store ───────────────────────────────────────────────────────────

interface SyncStoreState {
  config: SyncConfig;
  syncState: SyncState | null;
  conflicts: ConflictRecord[];
  isRegistering: boolean;
  registerError: string | null;
  isLoadingConflicts: boolean;
}

interface SyncStoreActions {
  setSyncState: (state: SyncState | null) => void;
  setConflicts: (conflicts: ConflictRecord[]) => void;
  setConfig: (partial: Partial<SyncConfig>) => void;

  syncNow: () => Promise<void>;
  configure: (config: SyncConfig) => Promise<void>;
  /** Register this device with the server using the server token. */
  registerDevice: (
    serverUrl: string,
    serverToken: string,
    deviceName: string,
  ) => Promise<{ deviceId: string; token: string }>;
  /** Re-register an existing device (returns existing record if deviceId known). */
  reRegisterDevice: (
    serverUrl: string,
    serverToken: string,
    deviceId: string,
    deviceName: string,
  ) => Promise<{ deviceId: string; token: string }>;
  verifyToken: (serverUrl: string, token: string) => Promise<boolean>;
  loadConflicts: () => void;
  resolveConflict: (id: number, resolution: "local" | "remote") => void;
  /** Disconnect and clear all persisted config so the user re-enters credentials. */
  disconnect: () => Promise<void>;
}

export type SyncStore = SyncStoreState & SyncStoreActions;

export const useSyncStore = create<SyncStore>((set, get) => ({
  config: {
    serverUrl: "",
    serverToken: "",
    deviceToken: "",
    deviceId: "",
    syncEnabled: false,
    syncIntervalMinutes: 5,
  },
  syncState: null,
  conflicts: [],
  isRegistering: false,
  registerError: null,
  isLoadingConflicts: false,

  setSyncState: (syncState) => set({ syncState }),
  setConflicts: (conflicts) => set({ conflicts }),
  setConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),

  syncNow: async () => {
    const engine = getSyncEngine();
    if (!engine) throw new Error("Sync is not configured");
    await engine.sync();
  },

  configure: async (config) => {
    persistConfig(config);
    set({ config });

    // Load timestamps before init so the engine starts with the
    // correct incremental sync window.
    const lastPushAt = getSetting(KEYS.lastPushAt);
    const lastPullAt = getSetting(KEYS.lastPullAt);

    initSyncEngine(config, {
      lastPushAt,
      lastPullAt,
      onStateChange: (state) => {
        useSyncStore.getState().setSyncState(state);
      },
    });
  },

  registerDevice: async (serverUrl, serverToken, deviceName) => {
    set({ isRegistering: true, registerError: null });
    try {
      const client = new SyncClient(serverUrl, serverToken, "");
      const result = await client.authRegister({
        deviceName: deviceName || "Mobile",
        deviceId: get().config.deviceId || undefined,
      });
      const cfg: SyncConfig = {
        serverUrl: result.serverUrl || serverUrl,
        serverToken,
        deviceToken: result.token,
        deviceId: result.deviceId,
        syncEnabled: true,
        syncIntervalMinutes: get().config.syncIntervalMinutes,
      };

      persistConfig(cfg);
      set({ config: cfg });

      initSyncEngine(cfg, {
        onStateChange: (state) => {
          useSyncStore.getState().setSyncState(state);
        },
      });

      // Seed the fresh device with a full push + pull. After this one-time
      // seed, subsequent restarts use incremental sync inside initSyncEngine.
      runInitialFullSync();

      set({ isRegistering: false });
      return { deviceId: result.deviceId, token: result.token };
    } catch (err) {
      set({
        isRegistering: false,
        registerError: (err as Error).message,
      });
      throw err;
    }
  },

  reRegisterDevice: async (serverUrl, serverToken, deviceId, deviceName) => {
    set({ isRegistering: true, registerError: null });
    try {
      const client = new SyncClient(serverUrl, serverToken, "");
      const result = await client.authRegister({
        deviceName,
        deviceId,
      });
      const cfg: SyncConfig = {
        serverUrl: result.serverUrl || serverUrl,
        serverToken,
        deviceToken: get().config.deviceToken,
        deviceId: result.deviceId,
        syncEnabled: true,
        syncIntervalMinutes: get().config.syncIntervalMinutes,
      };

      persistConfig(cfg);
      set({ config: cfg });

      initSyncEngine(cfg, {
        onStateChange: (state) => {
          useSyncStore.getState().setSyncState(state);
        },
      });

      // Seed the fresh device with a full push + pull. After this one-time
      // seed, subsequent restarts use incremental sync inside initSyncEngine.
      runInitialFullSync();

      set({ isRegistering: false });
      return { deviceId: result.deviceId, token: cfg.deviceToken };
    } catch (err) {
      set({
        isRegistering: false,
        registerError: (err as Error).message,
      });
      throw err;
    }
  },

  verifyToken: async (serverUrl, token) => {
    try {
      const client = new SyncClient(serverUrl, "", token);
      await client.authVerify();
      return true;
    } catch {
      return false;
    }
  },

  loadConflicts: () => {
    set({ isLoadingConflicts: true });
    try {
      const engine = getSyncEngine();
      if (!engine) {
        set({ conflicts: [], isLoadingConflicts: false });
        return;
      }
      const conflicts = engine.getConflicts();
      set({ conflicts, isLoadingConflicts: false });
    } catch {
      set({ isLoadingConflicts: false });
    }
  },

  resolveConflict: (id, resolution) => {
    const engine = getSyncEngine();
    if (!engine) return;
    engine.resolveConflict(id, resolution);
    set((s) => ({
      conflicts: s.conflicts.filter((c) => c.id !== id),
    }));
  },

  disconnect: async () => {
    teardownSyncEngine();
    clearPersistedConfig();

    set({
      config: {
        serverUrl: "",
        serverToken: "",
        deviceToken: "",
        deviceId: "",
        syncEnabled: false,
        syncIntervalMinutes: 5,
      },
      syncState: null,
      conflicts: [],
      registerError: null,
    });
  },
}));

// ── SQLite-based config persistence ─────────────────────────────────

type SettingKey = (typeof KEYS)[keyof typeof KEYS];

function getSetting(key: SettingKey): string | null {
  try {
    const sql = getSQLite();
    const row = sql.getFirstSync<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = ?",
      key,
    );
    return row?.value ?? null;
  } catch {
    return null;
  }
}

function getSettings(keys: SettingKey[]): Record<string, string | null> {
  try {
    const sql = getSQLite();
    const placeholders = keys.map(() => "?").join(", ");
    const rows = sql.getAllSync<{ key: string; value: string }>(
      `SELECT key, value FROM app_settings WHERE key IN (${placeholders})`,
      ...keys,
    );
    const map: Record<string, string | null> = {};
    for (const k of keys) map[k] = null;
    for (const row of rows) map[row.key] = row.value;
    return map;
  } catch {
    const map: Record<string, string | null> = {};
    for (const k of keys) map[k] = null;
    return map;
  }
}

function setSetting(key: SettingKey, value: string): void {
  try {
    const sql = getSQLite();
    sql.runSync(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
      key,
      value,
    );
  } catch {
    // DB may not be ready yet — ignore
  }
}

function persistConfig(cfg: SyncConfig): void {
  const sql = getSQLite();
  const stmt = (k: string, v: string) =>
    sql.runSync(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
      k,
      v,
    );
  stmt(KEYS.syncEnabled, cfg.syncEnabled ? "1" : "0");
  stmt(KEYS.serverUrl, cfg.serverUrl);
  stmt(KEYS.serverToken, cfg.serverToken);
  stmt(KEYS.deviceToken, cfg.deviceToken);
  stmt(KEYS.deviceId, cfg.deviceId);
  stmt(KEYS.syncIntervalMinutes, String(cfg.syncIntervalMinutes));
}

function clearPersistedConfig(): void {
  try {
    const sql = getSQLite();
    const placeholders = ALL_SYNC_KEYS.map(() => "?").join(", ");
    sql.runSync(
      `DELETE FROM app_settings WHERE key IN (${placeholders})`,
      ...ALL_SYNC_KEYS,
    );
  } catch {
    // ignore
  }
}

/**
 * Load sync config from SQLite app_settings table.
 * Called by SyncProvider on app startup.
 */
export async function loadPersistedSyncConfig(): Promise<SyncConfig> {
  try {
    const record = getSettings(ALL_SYNC_KEYS);

    const syncEnabled = record[KEYS.syncEnabled] === "1";
    if (!syncEnabled) {
      return {
        serverUrl: "",
        serverToken: "",
        deviceToken: "",
        deviceId: "",
        syncEnabled: false,
        syncIntervalMinutes: 5,
      };
    }

    return {
      serverUrl: record[KEYS.serverUrl] ?? "",
      serverToken: record[KEYS.serverToken] ?? "",
      deviceToken: record[KEYS.deviceToken] ?? "",
      deviceId: record[KEYS.deviceId] ?? "",
      syncEnabled: true,
      syncIntervalMinutes: parseInt(
        record[KEYS.syncIntervalMinutes] ?? "5",
        10,
      ),
    };
  } catch {
    return {
      serverUrl: "",
      serverToken: "",
      deviceToken: "",
      deviceId: "",
      syncEnabled: false,
      syncIntervalMinutes: 5,
    };
  }
}

// Re-export timestamp helpers used by SyncProvider
export { KEYS as SYNC_SETTINGS_KEYS, setSetting, getSetting, getSettings };
