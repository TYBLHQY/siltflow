/**
 * Sync status indicator — shows when the sync server is running.
 */
import { useState, useEffect, useCallback } from "react";

interface SyncStatus {
  running: boolean;
  port: number;
}

export interface SyncInfo {
  port: number;
}

/**
 * Hook to manage the sync server lifecycle.
 */
export function useSyncServer() {
  const [status, setStatus] = useState<SyncStatus>({ running: false, port: 0 });
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check status on mount
  useEffect(() => {
    window.siltflow.sync.status().then(setStatus).catch(() => {});
  }, []);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const result = await window.siltflow.sync.start();
      if (result.error) {
        setError(result.error);
      } else {
        setStatus({ running: true, port: result.port ?? 0 });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }, []);

  const stop = useCallback(async () => {
    await window.siltflow.sync.stop();
    setStatus({ running: false, port: 0 });
  }, []);

  return { status, starting, error, start, stop };
}
