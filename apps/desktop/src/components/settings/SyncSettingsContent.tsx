/**
 * Sync settings panel — configure connection to a SiltFlow sync server.
 *
 * Auth model (v2):
 *   1. User enters server URL + server token (from server startup log) → Connect
 *   2. Desktop registers as a device → server returns deviceId + deviceToken
 *   3. Config is persisted to vault (.siltflow/config.json) so restart works
 */

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Wifi, WifiOff, Loader2, Server, XCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSyncStore } from "@/stores/sync.store";

export function SyncSettingsContent() {
  const config = useSyncStore((s) => s.config);
  const syncState = useSyncStore((s) => s.syncState);
  const conflicts = useSyncStore((s) => s.conflicts);
  const isRegistering = useSyncStore((s) => s.isRegistering);
  const registerError = useSyncStore((s) => s.registerError);
  const isLoadingConflicts = useSyncStore((s) => s.isLoadingConflicts);

  const syncNow = useSyncStore((s) => s.syncNow);
  const registerDevice = useSyncStore((s) => s.registerDevice);
  const loadConflicts = useSyncStore((s) => s.loadConflicts);
  const resolveConflict = useSyncStore((s) => s.resolveConflict);
  const disconnect = useSyncStore((s) => s.disconnect);

  // Local form state
  const [serverUrl, setServerUrl] = useState(config.serverUrl || "");
  const [serverToken, setServerToken] = useState(config.serverToken || "");
  const [deviceName, setDeviceName] = useState("Desktop");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sync from config on mount
  useEffect(() => {
    if (config.serverUrl) setServerUrl(config.serverUrl);
    if (config.serverToken) setServerToken(config.serverToken);
  }, [config.serverUrl, config.serverToken]);

  // Load conflicts when tab opens
  useEffect(() => {
    if (config.syncEnabled) loadConflicts();
  }, [config.syncEnabled, loadConflicts]);

  const isConfigured = config.syncEnabled && config.deviceToken;

  const handleConnect = useCallback(async () => {
    if (!serverUrl || !serverToken) return;
    setStatusMessage(null);
    try {
      await registerDevice(serverUrl, serverToken, deviceName);
      setStatusMessage("Registered! Initial sync will start shortly.");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("401")) {
        setStatusMessage("Invalid server token. Check the token from server startup log.");
      } else {
        setStatusMessage(`Connection failed: ${msg}`);
      }
    }
  }, [serverUrl, serverToken, deviceName, registerDevice]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setStatusMessage(null);
  }, [disconnect]);

  const handleSyncNow = useCallback(async () => {
    try {
      setStatusMessage("Syncing…");
      await syncNow();
      setStatusMessage("Sync complete.");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("401") || msg.includes("invalid token")) {
        await handleDisconnect();
      } else {
        setStatusMessage(`Sync failed: ${msg}`);
      }
    }
  }, [syncNow, handleDisconnect]);

  // Auto-disconnect when token is no longer valid (revoked server-side)
  useEffect(() => {
    const msg = syncState?.lastError;
    if (msg && (msg.includes("401") || msg.includes("invalid token"))) {
      handleDisconnect();
    }
  }, [syncState?.lastError, handleDisconnect]);

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Server className="h-5 w-5" />
        <h2 className="text-base font-semibold">Sync Server</h2>
      </div>

      {/* Connection status (when configured) */}
      {isConfigured && (
        <div className="mb-4 rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Connection</span>
            {syncState?.connected ? (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <Wifi className="h-3 w-3" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-ctp-overlay0">
                <WifiOff className="h-3 w-3" /> Disconnected
              </span>
            )}
          </div>
          {syncState?.syncInProgress ? (
            <div className="flex items-center gap-2 text-xs text-ctp-overlay0">
              <Loader2 className="h-3 w-3 animate-spin" />
              Syncing…
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncNow}
                className="text-xs h-7"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Sync Now
              </Button>
            </div>
          )}
          {syncState?.lastPushAt && (
            <p className="text-[10px] text-ctp-overlay0">
              Last push: {new Date(syncState.lastPushAt).toLocaleString()}
            </p>
          )}
          {syncState?.lastPullAt && (
            <p className="text-[10px] text-ctp-overlay0">
              Last pull: {new Date(syncState.lastPullAt).toLocaleString()}
            </p>
          )}
          {syncState?.lastError && (
            <p className="text-[10px] text-ctp-red">{syncState.lastError}</p>
          )}
        </div>
      )}

      {/* Configuration form (when not connected) */}
      {!isConfigured && (
        <div className="space-y-3">
          {/* Server URL */}
          <div>
            <label className="text-xs font-medium text-ctp-text block mb-1">
              Server URL
            </label>
            <input
              className="w-full rounded border bg-ctp-base px-3 py-1.5 text-sm placeholder:text-ctp-overlay0"
              placeholder="http://192.168.1.100:3001"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
            />
          </div>

          {/* Server Token */}
          <div>
            <label className="text-xs font-medium text-ctp-text block mb-1">
              Server Token
            </label>
            <input
              className="w-full rounded border bg-ctp-base px-3 py-1.5 text-sm font-mono placeholder:text-ctp-overlay0"
              placeholder="From server startup log (64 hex chars)"
              value={serverToken}
              onChange={(e) => setServerToken(e.target.value)}
            />
            <p className="text-[10px] text-ctp-overlay0 mt-0.5">
              The server prints this token on startup. It proves you have permission to join.
            </p>
          </div>

          {/* Device name */}
          <div>
            <label className="text-xs font-medium text-ctp-text block mb-1">
              Device Name
            </label>
            <input
              className="w-full rounded border bg-ctp-base px-3 py-1.5 text-sm"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
            />
          </div>

          {/* Connect button */}
          <Button
            className="w-full text-sm"
            disabled={isRegistering || !serverUrl || !serverToken}
            onClick={handleConnect}
          >
            {isRegistering ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting…
              </>
            ) : (
              "Connect"
            )}
          </Button>

          {registerError && (
            <p className="text-xs text-ctp-red">{registerError}</p>
          )}
          {statusMessage && (
            <p className="text-xs text-ctp-overlay0">{statusMessage}</p>
          )}
        </div>
      )}

      {/* Connected: show device info */}
      {isConfigured && (
        <div className="space-y-2">
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">Server</span>
              <span className="text-xs text-ctp-overlay0 font-mono">{config.serverUrl}</span>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">Device ID</span>
              <span className="text-[10px] text-ctp-overlay0 font-mono">{config.deviceId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Sync Interval</span>
              <span className="text-xs text-ctp-overlay0">{config.syncIntervalMinutes} min</span>
            </div>
          </div>

          {/* Disconnect button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            className="text-xs h-7 w-full border-ctp-red/30 text-ctp-red hover:bg-ctp-red/10"
          >
            <LogOut className="h-3 w-3 mr-1" />
            Disconnect
          </Button>
        </div>
      )}

      {/* Conflicts */}
      {isConfigured && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Conflicts
            {conflicts.length > 0 && (
              <span className="text-[10px] bg-ctp-yellow/20 text-ctp-yellow px-1.5 rounded-full">
                {conflicts.length}
              </span>
            )}
          </h3>
          {isLoadingConflicts ? (
            <p className="text-xs text-ctp-overlay0">Loading…</p>
          ) : conflicts.length === 0 ? (
            <p className="text-xs text-ctp-overlay0">No unresolved conflicts</p>
          ) : (
            <div className="space-y-2">
              {conflicts.map((c) => (
                <div key={c.id} className="rounded-md border p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-ctp-overlay0">{c.tableName}</span>
                    <span className="text-[10px] text-ctp-overlay0">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-6 flex-1"
                      onClick={() => resolveConflict(c.id, "local")}
                    >
                      Keep Local
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-6 flex-1"
                      onClick={() => resolveConflict(c.id, "remote")}
                    >
                      Accept Remote
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
