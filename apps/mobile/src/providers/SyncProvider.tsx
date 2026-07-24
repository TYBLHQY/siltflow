/**
 * SyncProvider — React component that initializes the sync engine
 * from persisted config on app startup and manages the sync lifecycle.
 *
 * Must be placed inside <DatabaseProvider> since the sync engine
 * needs the database to be ready.
 */

import { useEffect, useRef, type PropsWithChildren } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  useSyncStore,
  loadPersistedSyncConfig,
  setSetting,
  getSetting,
} from "@/stores/sync.store";
import { initSyncEngine, teardownSyncEngine } from "@/sync";

const TIMESTAMP_KEYS = {
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
    loadPersistedSyncConfig().then((cfg) => {
      useSyncStore.getState().setConfig(cfg);

      if (cfg.syncEnabled && cfg.deviceToken) {
        // Load timestamps BEFORE init so the engine starts with the
        // correct incremental sync window and never fetches epoch→now.
        const lastPushAt = getSetting(TIMESTAMP_KEYS.lastPushAt);
        const lastPullAt = getSetting(TIMESTAMP_KEYS.lastPullAt);

        initSyncEngine(cfg, {
          lastPushAt,
          lastPullAt,
          onStateChange: (state) => {
            useSyncStore.getState().setSyncState(state);
            // Persist timestamps on every state change so the next
            // restart picks up the correct incremental window.
            if (state.lastPushAt) {
              setSetting(TIMESTAMP_KEYS.lastPushAt, state.lastPushAt);
            }
            if (state.lastPullAt) {
              setSetting(TIMESTAMP_KEYS.lastPullAt, state.lastPullAt);
            }
          },
        });
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
          if (lastPushAt) {
            setSetting(TIMESTAMP_KEYS.lastPushAt, lastPushAt);
          }
          if (lastPullAt) {
            setSetting(TIMESTAMP_KEYS.lastPullAt, lastPullAt);
          }
        }
      }
      appStateRef.current = nextState;
    });

    return () => sub.remove();
  }, []);

  return <>{children}</>;
}
