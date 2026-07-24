/**
 * Sync settings panel — configure connection to a SiltFlow sync server.
 *
 * Auth model (v2):
 *   1. User enters server URL + server token (from server startup log) → Connect
 *   2. Mobile registers as a device → server returns deviceId + deviceToken
 *   3. Config is persisted to AsyncStorage so restart works
 *
 * Adapted from apps/desktop/src/components/settings/SyncSettingsContent.tsx
 */

import { useState, useEffect, useCallback } from "react";
import { View, Text } from "@/tw";
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Spinner, Badge } from "@/components/ui";
import { useSyncStore } from "@/stores/sync.store";
import { getSQLite } from "@/stores/db.store";
import { initSchema } from "@siltflow/shared-db/migrations";
import { SCHEMA_VERSION } from "@siltflow/shared-db/types";
import { ENTITY_TABLES } from "@siltflow/shared-lib";
import { createExpoSqliteExecutor } from "@/lib/expo-sqlite-adapter";

/** All tables managed by the mobile database. */
const ALL_TABLES = [
  ...ENTITY_TABLES,
  "sync_op_log",
  "sync_tombstones",
  "sync_tombstone_acks",
  "app_settings",
];

export function SyncSettings() {
  const config = useSyncStore((s) => s.config);
  const syncState = useSyncStore((s) => s.syncState);
  const isRegistering = useSyncStore((s) => s.isRegistering);
  const registerError = useSyncStore((s) => s.registerError);

  const syncNow = useSyncStore((s) => s.syncNow);
  const registerDevice = useSyncStore((s) => s.registerDevice);
  const disconnect = useSyncStore((s) => s.disconnect);

  // Local form state
  const [serverUrl, setServerUrl] = useState(config.serverUrl || "");
  const [serverToken, setServerToken] = useState(config.serverToken || "");
  const [deviceName, setDeviceName] = useState("Mobile");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sync from config on mount
  useEffect(() => {
    if (config.serverUrl) setServerUrl(config.serverUrl);
    if (config.serverToken) setServerToken(config.serverToken);
  }, [config.serverUrl, config.serverToken]);

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

  // -- Reset database ---------------------------------------------------

  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const handleResetDb = useCallback(() => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    setIsResetting(true);
    setResetConfirm(false);
    setStatusMessage("Resetting database…");
    try {
      const sql = getSQLite();
      sql.execSync("BEGIN TRANSACTION");
      for (const table of ALL_TABLES) {
        sql.execSync(`DELETE FROM ${table}`);
      }
      sql.execSync("PRAGMA user_version = 0");
      sql.execSync("COMMIT");
      // Re-run schema init so tables are ready for use
      const executor = createExpoSqliteExecutor(sql);
      initSchema(executor, 0);
      sql.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      setStatusMessage("Database reset complete. Reconnect to sync server.");
    } catch (err) {
      try { getSQLite().execSync("ROLLBACK"); } catch { /* ignore */ }
      setStatusMessage(`Reset failed: ${(err as Error).message}`);
    } finally {
      setIsResetting(false);
    }
  }, [resetConfirm]);

  const cancelReset = useCallback(() => {
    setResetConfirm(false);
  }, []);

  // -- Render -------------------------------------------------------------

  return (
    <View className="gap-4">
      {/* Header */}
      <Text className="text-lg font-semibold text-ctp-text">Sync Server</Text>

      {/* Connection status (when configured) */}
      {isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle>Connection</CardTitle>
            <CardDescription>
              {syncState?.connected ? "Connected to sync server" : "Disconnected"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <View className="gap-3">
              {/* Status badge */}
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-ctp-subtext0">Status</Text>
                <Badge variant={syncState?.connected ? "success" : "secondary"}>
                  {syncState?.connected ? "Connected" : "Offline"}
                </Badge>
                {syncState?.syncInProgress && (
                  <View className="flex-row items-center gap-1">
                    <Spinner size="sm" />
                    <Text className="text-xs text-ctp-subtext0">Syncing…</Text>
                  </View>
                )}
              </View>

              {/* Server info */}
              <View className="flex-row justify-between">
                <Text className="text-xs text-ctp-subtext0">Server</Text>
                <Text className="text-xs text-ctp-overlay0" numberOfLines={1}>
                  {config.serverUrl}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-xs text-ctp-subtext0">Device ID</Text>
                <Text className="text-xs text-ctp-overlay0" numberOfLines={1}>
                  {config.deviceId}
                </Text>
              </View>

              {/* Sync Now button */}
              <Button
                variant="outline"
                size="sm"
                onPress={handleSyncNow}
                disabled={syncState?.syncInProgress}
              >
                Sync Now
              </Button>

              {/* Timestamps */}
              {syncState?.lastPushAt && (
                <Text className="text-xs text-ctp-overlay0">
                  Last push: {new Date(syncState.lastPushAt).toLocaleString()}
                </Text>
              )}
              {syncState?.lastPullAt && (
                <Text className="text-xs text-ctp-overlay0">
                  Last pull: {new Date(syncState.lastPullAt).toLocaleString()}
                </Text>
              )}
              {syncState?.lastError && (
                <Text className="text-xs text-ctp-red">{syncState.lastError}</Text>
              )}
            </View>
          </CardContent>
        </Card>
      )}

      {/* Configuration form (when not connected) */}
      {!isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle>Connect to Server</CardTitle>
            <CardDescription>
              Enter your sync server details to connect this device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <View className="gap-3">
              <Input
                label="Server URL"
                placeholder="http://192.168.1.100:3001"
                value={serverUrl}
                onChangeText={setServerUrl}
                keyboardType="url"
                autoCapitalize="none"
              />

              <Input
                label="Server Token"
                placeholder="From server startup log"
                value={serverToken}
                onChangeText={setServerToken}
                autoCapitalize="none"
              />
              <Text className="text-xs text-ctp-overlay0">
                The server prints this token on startup. It proves you have permission to join.
              </Text>

              <Input
                label="Device Name"
                placeholder="My Phone"
                value={deviceName}
                onChangeText={setDeviceName}
              />

              <Button
                onPress={handleConnect}
                disabled={isRegistering || !serverUrl || !serverToken}
                loading={isRegistering}
              >
                {isRegistering ? "Connecting…" : "Connect"}
              </Button>

              {registerError && (
                <Text className="text-sm text-ctp-red">{registerError}</Text>
              )}
              {statusMessage && (
                <Text className="text-sm text-ctp-overlay0">{statusMessage}</Text>
              )}
            </View>
          </CardContent>
        </Card>
      )}

      {/* Connected: server info */}
      {isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle>Server Info</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-sm text-ctp-subtext0">Server URL</Text>
                <Text className="text-sm text-ctp-text" numberOfLines={1}>{config.serverUrl}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-ctp-subtext0">Device ID</Text>
                <Text className="text-xs text-ctp-overlay0" numberOfLines={1}>{config.deviceId}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-ctp-subtext0">Sync Interval</Text>
                <Text className="text-sm text-ctp-text">{config.syncIntervalMinutes} min</Text>
              </View>
            </View>
          </CardContent>
        </Card>
      )}

      {/* Disconnect button (when connected) */}
      {isConfigured && (
        <Button
          variant="destructive"
          onPress={handleDisconnect}
        >
          Disconnect
        </Button>
      )}

      {/* Reset Database */}
      <Card className="border-ctp-red/30">
        <CardHeader>
          <CardTitle className="text-ctp-red">Danger Zone</CardTitle>
          <CardDescription>
            This wipes all local data including synced documents, annotations,
            FSRS cards, review logs, and sync config. The server is not affected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <View className="gap-2">
            {statusMessage && (
              <Text className="text-sm text-ctp-overlay0">{statusMessage}</Text>
            )}
            {resetConfirm ? (
              <View className="flex-row gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  loading={isResetting}
                  onPress={handleResetDb}
                  className="flex-1"
                >
                  {isResetting ? "Resetting…" : "Yes, Reset Everything"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={cancelReset}
                  disabled={isResetting}
                >
                  Cancel
                </Button>
              </View>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onPress={handleResetDb}
              >
                Reset Database
              </Button>
            )}
          </View>
        </CardContent>
      </Card>
    </View>
  );
}
