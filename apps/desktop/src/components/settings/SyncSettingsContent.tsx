/**
 * Sync settings panel — configure connection to a SiltFlow sync server.
 *
 * Flow:
 * 1. User enters server URL + device name → clicks Connect
 * 2. If server is fresh (no devices yet), bootstrap succeeds → device becomes admin
 * 3. If server already has devices, bootstrap returns 409 → UI shows admin-token
 *    input so the user can request registration from the admin
 */

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Wifi, WifiOff, Loader2, Server, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSyncStore } from "@/stores/sync.store";

export function SyncSettingsContent() {
  const config = useSyncStore((s) => s.config);
  const syncState = useSyncStore((s) => s.syncState);
  const conflicts = useSyncStore((s) => s.conflicts);
  const isBootstrapping = useSyncStore((s) => s.isBootstrapping);
  const bootstrapError = useSyncStore((s) => s.bootstrapError);
  const isLoadingConflicts = useSyncStore((s) => s.isLoadingConflicts);

  const syncNow = useSyncStore((s) => s.syncNow);
  const bootstrap = useSyncStore((s) => s.bootstrap);
  const registerWithToken = useSyncStore((s) => s.registerWithToken);
  const loadConflicts = useSyncStore((s) => s.loadConflicts);
  const resolveConflict = useSyncStore((s) => s.resolveConflict);

  // Local form state
  const [serverUrl, setServerUrl] = useState(config.serverUrl || "");
  const [deviceName, setDeviceName] = useState("Desktop");
  const [adminToken, setAdminToken] = useState("");
  const [needsAdminToken, setNeedsAdminToken] = useState(false); // bootstrap returned 409
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sync state from config on mount
  useEffect(() => {
    if (config.serverUrl) setServerUrl(config.serverUrl);
  }, [config.serverUrl]);

  // Load conflicts when tab opens
  useEffect(() => {
    if (config.syncEnabled) loadConflicts();
  }, [config.syncEnabled, loadConflicts]);

  const isConfigured = config.syncEnabled && config.deviceToken;

  // Try bootstrap first. If server returns 409 (devices exist), show admin-token input.
  const handleConnect = useCallback(async () => {
    if (!serverUrl) return;
    setNeedsAdminToken(false);
    setStatusMessage(null);
    try {
      await bootstrap(serverUrl, deviceName);
      setStatusMessage("Connected! Initial sync will start shortly.");
    } catch (err) {
      const msg = (err as Error).message;
      // The IPC layer returns a special error when the server already has devices
      if (msg === "NEEDS_ADMIN_TOKEN" || msg.includes("409") || msg.includes("bootstrap already completed")) {
        setNeedsAdminToken(true);
        setStatusMessage("Server already has devices. Enter the admin token to join.");
      } else {
        setStatusMessage(`Connection failed: ${msg}`);
      }
    }
  }, [serverUrl, deviceName, bootstrap]);

  // Register with admin token (shown after bootstrap returns 409)
  const handleRegister = useCallback(async () => {
    if (!serverUrl || !adminToken) return;
    try {
      setStatusMessage(null);
      await registerWithToken(serverUrl, adminToken, deviceName);
      setStatusMessage("Joined server! Initial sync will start shortly.");
      setNeedsAdminToken(false);
    } catch (err) {
      setStatusMessage(`Registration failed: ${(err as Error).message}`);
    }
  }, [serverUrl, adminToken, deviceName, registerWithToken]);

  const handleSyncNow = useCallback(async () => {
    try {
      setStatusMessage("Syncing…");
      await syncNow();
      setStatusMessage("Sync complete.");
    } catch (err) {
      setStatusMessage(`Sync failed: ${(err as Error).message}`);
    }
  }, [syncNow]);

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
              onChange={(e) => { setServerUrl(e.target.value); setNeedsAdminToken(false); }}
            />
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

          {/* Admin token — only shown when bootstrap returns 409 */}
          {needsAdminToken && (
            <div className="rounded-md border border-ctp-yellow/30 bg-ctp-yellow/5 p-3 space-y-2">
              <p className="text-xs text-ctp-yellow">
                This server already has devices. Ask the admin for a registration token.
              </p>
              <div>
                <label className="text-xs font-medium text-ctp-text block mb-1">
                  Admin Token
                </label>
                <input
                  className="w-full rounded border bg-ctp-base px-3 py-1.5 text-sm font-mono placeholder:text-ctp-overlay0"
                  placeholder="64-character hex token"
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                />
              </div>
              <Button
                className="w-full text-sm"
                disabled={isBootstrapping || !adminToken}
                onClick={handleRegister}
              >
                Register Device
              </Button>
            </div>
          )}

          {/* Connect button (hidden when asking for admin token) */}
          {!needsAdminToken && (
            <Button
              className="w-full text-sm"
              disabled={isBootstrapping || !serverUrl}
              onClick={handleConnect}
            >
              {isBootstrapping ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting…
                </>
              ) : (
                "Connect"
              )}
            </Button>
          )}

          {bootstrapError && (
            <p className="text-xs text-ctp-red">{bootstrapError}</p>
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
