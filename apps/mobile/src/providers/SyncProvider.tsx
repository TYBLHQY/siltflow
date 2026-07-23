/**
 * SyncProvider — React component that initializes the sync engine
 * from persisted config on app startup and manages the sync lifecycle.
 *
 * Must be placed inside <DatabaseProvider> since the sync engine
 * needs the database to be ready.
 */

import { useEffect, useRef, type PropsWithChildren } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useSyncStore, loadPersistedSyncConfig } from "@/stores/sync.store";
import { initSyncEngine, teardownSyncEngine, setSyncTimestamps } from "@/sync";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  lastPushAt: "sync:lastPushAt",
  lastPullAt: "sync:lastPullAt",
} as const;

export function SyncProvider({ children }: PropsWithChildren) {
  const initialized = useRef(false);
  const appStateRef = useRef<AppStateStatus>("active");

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Load persisted config and start engine
    loadPersistedSyncConfig().then(async (cfg) => {
      useSyncStore.getState().setConfig(cfg);

      if (cfg.syncEnabled && cfg.deviceToken) {
        // Init engine
        initSyncEngine(cfg, (state) => {
          useSyncStore.getState().setSyncState(state);
        });

        // Restore persisted timestamps
        const lastPushAt = await AsyncStorage.getItem(STORAGE_KEYS.lastPushAt);
        const lastPullAt = await AsyncStorage.getItem(STORAGE_KEYS.lastPullAt);
        setSyncTimestamps(lastPushAt, lastPullAt);
      }
    });

    return () => {
      teardownSyncEngine();
    };
  }, []);

  // Persist timestamps on app state change (going to background)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      // When going to background, persist timestamps
      if (
        appStateRef.current === "active" &&
        nextState.match(/inactive|background/)
      ) {
        const engine = require("@/sync").getSyncEngine();
        if (engine) {
          const { lastPushAt, lastPullAt } = engine.state;
          AsyncStorage.setMany({
            [STORAGE_KEYS.lastPushAt]: lastPushAt ?? "",
            [STORAGE_KEYS.lastPullAt]: lastPullAt ?? "",
          }).catch(() => {});
        }
      }
      appStateRef.current = nextState;
    });

    return () => sub.remove();
  }, []);

  return <>{children}</>;
}
