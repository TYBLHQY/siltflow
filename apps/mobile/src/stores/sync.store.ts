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
 * All three + serverUrl are persisted to AsyncStorage so restarting
 * the mobile app reconnects without re-entering credentials.
 *
 * Adapted from apps/desktop/src/stores/sync.store.ts
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SyncState, SyncConfig } from "@siltflow/shared-lib";
import type { ConflictRecord } from "@/sync/sync-engine";
import { SyncClient } from "@/sync/sync-client";
import {
  initSyncEngine,
  teardownSyncEngine,
  getSyncEngine,
  setSyncTimestamps,
} from "@/sync";

// ── AsyncStorage keys ───────────────────────────────────────────────

const STORAGE_KEYS = {
  syncEnabled: "sync:enabled",
  serverUrl: "sync:serverUrl",
  serverToken: "sync:serverToken",
  deviceToken: "sync:deviceToken",
  deviceId: "sync:deviceId",
  syncIntervalMinutes: "sync:intervalMinutes",
  lastPushAt: "sync:lastPushAt",
  lastPullAt: "sync:lastPullAt",
} as const;

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
    // Persist to AsyncStorage
    await persistConfig(config);
    set({ config });

    // Re-init engine with new config
    initSyncEngine(config, (state) => {
      useSyncStore.getState().setSyncState(state);
    });

    // Restore timestamps from storage
    const lastPushAt = await AsyncStorage.getItem(STORAGE_KEYS.lastPushAt);
    const lastPullAt = await AsyncStorage.getItem(STORAGE_KEYS.lastPullAt);
    setSyncTimestamps(lastPushAt, lastPullAt);
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

      // Persist and start engine
      await persistConfig(cfg);
      set({ config: cfg });

      initSyncEngine(cfg, (state) => {
        useSyncStore.getState().setSyncState(state);
      });

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
        deviceToken: get().config.deviceToken, // keep existing token
        deviceId: result.deviceId,
        syncEnabled: true,
        syncIntervalMinutes: get().config.syncIntervalMinutes,
      };

      await persistConfig(cfg);
      set({ config: cfg });

      initSyncEngine(cfg, (state) => {
        useSyncStore.getState().setSyncState(state);
      });

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

    // Clear persisted config
    await clearPersistedConfig();

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

// ── Config persistence helpers ───────────────────────────────────────

async function persistConfig(cfg: SyncConfig): Promise<void> {
  const entries: [string, string][] = [
    [STORAGE_KEYS.syncEnabled, cfg.syncEnabled ? "1" : "0"],
    [STORAGE_KEYS.serverUrl, cfg.serverUrl],
    [STORAGE_KEYS.serverToken, cfg.serverToken],
    [STORAGE_KEYS.deviceToken, cfg.deviceToken],
    [STORAGE_KEYS.deviceId, cfg.deviceId],
    [STORAGE_KEYS.syncIntervalMinutes, String(cfg.syncIntervalMinutes)],
  ];
  await AsyncStorage.setMany(Object.fromEntries(entries));
}

async function clearPersistedConfig(): Promise<void> {
  const keys = Object.values(STORAGE_KEYS);
  await AsyncStorage.removeMany(keys);
}

/**
 * Load sync config from AsyncStorage.
 * Called by SyncProvider on app startup.
 */
export async function loadPersistedSyncConfig(): Promise<SyncConfig> {
  try {
    const keys = Object.values(STORAGE_KEYS);
    const record = await AsyncStorage.getMany(keys);

    const syncEnabled = record[STORAGE_KEYS.syncEnabled] === "1";
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
      serverUrl: record[STORAGE_KEYS.serverUrl] ?? "",
      serverToken: record[STORAGE_KEYS.serverToken] ?? "",
      deviceToken: record[STORAGE_KEYS.deviceToken] ?? "",
      deviceId: record[STORAGE_KEYS.deviceId] ?? "",
      syncEnabled: true,
      syncIntervalMinutes: parseInt(
        record[STORAGE_KEYS.syncIntervalMinutes] ?? "5",
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
