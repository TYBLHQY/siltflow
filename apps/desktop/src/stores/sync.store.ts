/**
 * Sync Zustand store — mirrors the main-process SyncEngine state in the
 * renderer and provides actions to configure and trigger sync.
 *
 * Auth model (v2):
 *   serverToken — server-level secret, user enters once per server
 *   deviceToken — per-device secret, server returns on registration
 *   deviceId    — device identity, server returns on registration
 *
 * All three + serverUrl are persisted to the vault config so restarting
 * the desktop app reconnects without re-entering credentials.
 */

import { create } from "zustand";
import type { SyncState, SyncConfig } from "@siltflow/shared-lib";
import type { ConflictRecord } from "../../electron/sync/sync-engine";

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
  setConfig: (config: Partial<SyncConfig>) => void;

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
  loadConflicts: () => Promise<void>;
  resolveConflict: (id: number, resolution: "local" | "remote") => Promise<void>;
}

export type SyncStore = SyncStoreState & SyncStoreActions;

export const useSyncStore = create<SyncStore>((set, get) => {
  if (typeof window !== "undefined" && window.siltflow?.sync?.onStateChange) {
    window.siltflow.sync.onStateChange((newState) => {
      set({ syncState: newState });
    });
  }

  return {
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
      try {
        await window.siltflow.sync.syncNow();
      } catch (err) {
        console.error("Sync failed:", err);
        throw err;
      }
    },

    configure: async (config) => {
      await window.siltflow.sync.configure(config);
      set({ config });
    },

    registerDevice: async (serverUrl, serverToken, deviceName) => {
      set({ isRegistering: true, registerError: null });
      try {
        const result = await window.siltflow.sync.registerDevice(
          serverUrl,
          serverToken,
          deviceName,
          get().config.deviceId || undefined,
        );
        const cfg: SyncConfig = {
          serverUrl: result.serverUrl || serverUrl,
          serverToken,
          deviceToken: result.token,
          deviceId: result.deviceId,
          syncEnabled: true,
          syncIntervalMinutes: get().config.syncIntervalMinutes,
        };
        await window.siltflow.sync.configure(cfg);
        set({ config: cfg, isRegistering: false });
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
        const result = await window.siltflow.sync.registerDevice(
          serverUrl,
          serverToken,
          deviceName,
          deviceId,
        );
        const cfg: SyncConfig = {
          serverUrl: result.serverUrl || serverUrl,
          serverToken,
          deviceToken: get().config.deviceToken, // keep existing token
          deviceId: result.deviceId,
          syncEnabled: true,
          syncIntervalMinutes: get().config.syncIntervalMinutes,
        };
        await window.siltflow.sync.configure(cfg);
        set({ config: cfg, isRegistering: false });
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
        await window.siltflow.sync.verifyToken(serverUrl, token);
        return true;
      } catch {
        return false;
      }
    },

    loadConflicts: async () => {
      set({ isLoadingConflicts: true });
      try {
        const conflicts = await window.siltflow.sync.getConflicts();
        set({ conflicts, isLoadingConflicts: false });
      } catch {
        set({ isLoadingConflicts: false });
      }
    },

    resolveConflict: async (id, resolution) => {
      await window.siltflow.sync.resolveConflict(id, resolution);
      set((s) => ({ conflicts: s.conflicts.filter((c) => c.id !== id) }));
    },
  };
});
