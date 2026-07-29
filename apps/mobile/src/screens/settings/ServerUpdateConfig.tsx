/**
 * Server update config panel — shows sync server version and lets
 * the admin trigger a CJS self-update on the connected server.
 *
 * Only visible when sync is configured and the user has the server token
 * (i.e. they are the admin who set up the server).
 */

import { useState, useCallback, useEffect } from "react";
import { View, Text, Pressable } from "@/tw";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Card, CardContent, Spinner } from "@/components/ui";
import { useSyncStore } from "@/stores/sync.store";
import {
  fetchServerHealth,
  fetchLatestServerVersion,
  isNewerServer,
  triggerServerUpdate,
  type ServerHealth,
} from "@/services/server-update.service";

export function ServerUpdateConfig() {
  const config = useSyncStore((s) => s.config);

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const serverUrl = config.serverUrl;

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setIsError(false);
    try {
      const h = await fetchServerHealth(serverUrl);
      setHealth(h);
    } catch (err) {
      setHealth(null);
      setStatus(`Cannot reach server: ${(err as Error).message}`);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [serverUrl]);

  // Fetch status on mount.
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    fetchStatus();
  }, [fetchStatus]);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    setStatus(null);
    setIsError(false);
    try {
      // Refresh health first
      const h = await fetchServerHealth(serverUrl);
      setHealth(h);
      const latest = await fetchLatestServerVersion();
      setLatestVersion(latest);
      if (!latest) {
        setStatus("Could not find server releases on GitHub.");
        setIsError(true);
      } else if (isNewerServer(latest, h.version)) {
        setStatus(`Server v${latest} available (current: v${h.version}).`);
      } else {
        setStatus("Server is up to date.");
      }
    } catch (err) {
      setStatus(`Check failed: ${(err as Error).message}`);
      setIsError(true);
    } finally {
      setChecking(false);
    }
  }, [serverUrl]);

  const handleUpdate = useCallback(async () => {
    const serverToken = config.serverToken;
    if (!serverToken) {
      setStatus("No server token configured. Reconnect to the server first.");
      setIsError(true);
      return;
    }
    setUpdating(true);
    setStatus("Updating server…");
    setIsError(false);
    try {
      const result = await triggerServerUpdate(serverUrl, serverToken);
      if (result.updated) {
        setStatus(`Server updated to v${result.remoteVersion} and is restarting.`);
        // Health check will go stale while restarting — that's expected
        setHealth(null);
      } else if (result.error) {
        setStatus(`Update failed: ${result.error}`);
        setIsError(true);
      } else {
        setStatus(result.reason || result.message || "No update performed.");
      }
    } catch (err) {
      setStatus(`Update failed: ${(err as Error).message}`);
      setIsError(true);
    } finally {
      setUpdating(false);
    }
  }, [serverUrl, config.serverToken]);

  // Only show when sync is configured
  if (!config.syncEnabled || !config.serverUrl) return null;

  const hasUpdate = health && latestVersion && isNewerServer(latestVersion, health.version);

  const statusColor = isError ? "text-ctp-red" : hasUpdate ? "text-ctp-peach" : "text-ctp-green";

  return (
    <View className="gap-4">
      {/* Header */}
      <View className="flex-row items-center gap-2">
        <Text className="text-lg font-semibold text-ctp-text">Server</Text>
      </View>

      <Card>
        <CardContent>
          <View className="gap-3 pt-3">
            {/* Server URL */}
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-ctp-subtext0">Server</Text>
              <Text className="text-xs text-ctp-overlay0" numberOfLines={1}>
                {serverUrl}
              </Text>
            </View>

            {/* Server version */}
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-ctp-subtext0">Server Version</Text>
              {loading ? (
                <Spinner size="sm" />
              ) : health ? (
                <Text className="text-sm text-ctp-text">v{health.version}</Text>
              ) : (
                <Text className="text-sm text-ctp-red">offline</Text>
              )}
            </View>

            {/* Latest available */}
            {latestVersion ? (
              <View className="flex-row justify-between items-center">
                <Text className="text-sm text-ctp-subtext0">Latest</Text>
                <Text className="text-sm text-ctp-mauve">v{latestVersion}</Text>
              </View>
            ) : null}

            {/* Status */}
            {status ? (
              <View className="flex-row items-start gap-1.5">
                {isError ? (
                  <MaterialCommunityIcons name="alert-circle" size={14} color="#f38ba8" />
                ) : null}
                <Text className={`text-sm flex-1 ${statusColor}`}>{status}</Text>
              </View>
            ) : null}

            {/* Actions */}
            <View className="flex-row gap-2">
              <Pressable
                onPress={handleCheck}
                disabled={checking}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-md border border-ctp-surface1 bg-transparent px-4 py-2.5 active:bg-ctp-surface0"
              >
                {checking ? <Spinner size="sm" /> : null}
                <Text className="text-sm font-medium text-ctp-text">
                  {checking ? "Checking…" : "Check for Update"}
                </Text>
              </Pressable>

              {hasUpdate ? (
                <Pressable
                  onPress={handleUpdate}
                  disabled={updating}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-md bg-ctp-mauve px-4 py-2.5 active:bg-ctp-mauve/80"
                >
                  <MaterialCommunityIcons
                    name="cloud-download"
                    size={16}
                    color={updating ? "#999" : "#ede6f8"}
                  />
                  <Text className={`text-sm font-medium ${updating ? "text-ctp-overlay0" : "text-ctp-base"}`}>
                    {updating ? "Updating…" : `Update to v${latestVersion}`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </CardContent>
      </Card>
    </View>
  );
}
