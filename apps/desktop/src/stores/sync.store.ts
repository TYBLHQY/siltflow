/**
 * Sync Zustand store — mirrors the main-process SyncEngine state in the
 * renderer and provides actions to configure and trigger sync.
 */

import { create } from "zustand";
import type { SyncState, SyncConfig } from "@siltflow/shared-lib";
import type { ConflictRecord } from "../../electron/sync/sync-engine";

interface SyncStoreState {
  // Server config (persisted in vault config, loaded at startup)
  config: SyncConfig;
  // Live state from the main process engine
  syncState: SyncState | null;
  // Conflicts waiting for resolution
  conflicts: ConflictRecord[];
  // UI state
  isBootstrapping: boolean;
  bootstrapError: string | null;
  isLoadingConflicts: boolean;
}

interface SyncStoreActions {
  // State updates (called from main process events or IPC)
  setSyncState: (state: SyncState | null) => void;
  setConflicts: (conflicts: ConflictRecord[]) => void;
  setConfig: (config: Partial<SyncConfig>) => void;

  // Actions that call IPC
  syncNow: () => Promise<void>;
  configure: (config: SyncConfig) => Promise<void>;
  bootstrap: (serverUrl: string, deviceName: string) => Promise<void>;
  registerWithToken: (
    serverUrl: string,
    adminToken: string,
    deviceName: string,
  ) => Promise<{ deviceId: string; token: string }>;
  verifyToken: (serverUrl: string, token: string) => Promise<boolean>;
  loadConflicts: () => Promise<void>;
  resolveConflict: (id: number, resolution: "local" | "remote") => Promise<void>;
}

export type SyncStore = SyncStoreState & SyncStoreActions;

export const useSyncStore = create<SyncStore>((set, get) => {
  // Listen for state changes pushed from the main process
  if (typeof window !== "undefined" && window.siltflow?.sync?.onStateChange) {
    window.siltflow.sync.onStateChange((newState) => {
      set({ syncState: newState });
    });
  }

  // Load persisted config from vault on store creation (non-blocking).
  // Starts with empty defaults — the async load updates via set() shortly after.
  if (typeof window !== "undefined" && window.siltflow?.vaultConfigGet) {
    window.siltflow.vaultConfigGet().then((vaultCfg) => {
      if (vaultCfg.syncEnabled) {
        set({
          config: {
            serverUrl: (vaultCfg.syncServerUrl as string) ?? "",
            deviceToken: (vaultCfg.syncDeviceToken as string) ?? "",
            deviceId: (vaultCfg.syncDeviceId as string) ?? "",
            syncEnabled: true,
            syncIntervalMinutes: (vaultCfg.syncIntervalMinutes as number) ?? 5,
          },
        });
      }
    }).catch(() => { /* vault config not available yet */ });
  }

  return {
  config: {
    serverUrl: "",
    deviceToken: "",
    deviceId: "",
    syncEnabled: false,
    syncIntervalMinutes: 5,
  },
  syncState: null,
  conflicts: [],
  isBootstrapping: false,
  bootstrapError: null,
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

  bootstrap: async (serverUrl, deviceName) => {
    set({ isBootstrapping: true, bootstrapError: null });
    try {
      const result = await window.siltflow.sync.bootstrap(
        serverUrl,
        deviceName,
      );
      // Check if server already has devices (409 response from IPC layer)
      if ("needsAdminToken" in result && result.needsAdminToken) {
        set({ isBootstrapping: false });
        throw new Error("NEEDS_ADMIN_TOKEN");
      }
      const result_ = result as {
        deviceId: string; token: string; serverUrl: string;
      };
      const cfg: SyncConfig = {
        serverUrl: result_.serverUrl || serverUrl,
        deviceToken: result_.token,
        deviceId: result_.deviceId,
        syncEnabled: true,
        syncIntervalMinutes: get().config.syncIntervalMinutes,
      };
      await window.siltflow.sync.configure(cfg);
      set({ config: cfg, isBootstrapping: false });
    } catch (err) {
      set({
        isBootstrapping: false,
        bootstrapError: (err as Error).message,
      });
      throw err;
    }
  },

  registerWithToken: async (serverUrl, adminToken, deviceName) => {
    const result = await window.siltflow.sync.registerWithToken(
      serverUrl,
      adminToken,
      deviceName,
    );
    const cfg: SyncConfig = {
      serverUrl: result.serverUrl || serverUrl,
      deviceToken: result.token,
      deviceId: result.deviceId,
      syncEnabled: true,
      syncIntervalMinutes: get().config.syncIntervalMinutes,
    };
    await window.siltflow.sync.configure(cfg);
    set({ config: cfg });
    return { deviceId: result.deviceId, token: result.token };
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
    // Remove from local list
    set((s) => ({ conflicts: s.conflicts.filter((c) => c.id !== id) }));
  },
  };
});
