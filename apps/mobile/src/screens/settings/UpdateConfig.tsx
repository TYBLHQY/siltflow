/**
 * Update config panel — version display + in-app update check.
 *
 * Fetches the latest release manifest from GitHub Releases,
 * downloads the APK, and triggers the system installer (Android only).
 */

import { useState, useCallback } from "react";
import { Platform } from "react-native";
import { View, Text, Pressable } from "@/tw";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Card, CardContent, Spinner } from "@/components/ui";
import { checkForUpdates, downloadAndInstall, getCurrentVersion } from "@/services/update.service";

const currentVersion = getCurrentVersion();

export function UpdateConfig() {
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    setStatus(null);
    setIsError(false);
    setHasUpdate(false);
    setUpdateVersion(null);
    try {
      const { hasUpdate: available, latest } = await checkForUpdates();
      if (available && latest) {
        setHasUpdate(true);
        setUpdateVersion(latest.versionName);
        const sizeMB = latest.size ? ` (${Math.round(latest.size / 1024 / 1024)} MB)` : "";
        setStatus(`New version ${latest.versionName} available${sizeMB}`);
      } else {
        setStatus("You are up to date.");
      }
    } catch (err) {
      setStatus(`Check failed: ${(err as Error).message}`);
      setIsError(true);
    } finally {
      setChecking(false);
    }
  }, []);

  const handleUpdate = useCallback(async () => {
    if (Platform.OS !== "android") {
      setStatus("In-app updates are only supported on Android.");
      setIsError(true);
      return;
    }
    setDownloading(true);
    setProgress(0);
    setIsError(false);
    setStatus("Downloading…");
    try {
      await downloadAndInstall(setProgress);
      setStatus("Installer opened. Follow the system prompt to complete the update.");
    } catch (err) {
      setStatus(`Update failed: ${(err as Error).message}`);
      setIsError(true);
    } finally {
      setDownloading(false);
    }
  }, []);

  const statusColor = isError ? "text-ctp-red" : hasUpdate ? "text-ctp-peach" : "text-ctp-green";

  /** Render progress bar + percentage when downloading. */
  const renderProgress = () => (
    <View className="gap-1">
      <View className="h-1.5 rounded-full" style={{ backgroundColor: "rgba(128,128,128,0.2)" }}>
        <View className="h-1.5 rounded-full bg-ctp-mauve" style={{ width: `${progress}%` }} />
      </View>
      <Text className="text-xs text-ctp-overlay0 text-right">{progress}%</Text>
    </View>
  );

  /** Render the download-and-install button, only when an update is available on Android. */
  const renderUpdateButton = () =>
    hasUpdate && Platform.OS === "android" ? (
      <Pressable
        onPress={handleUpdate}
        disabled={downloading}
        className="flex-1 flex-row items-center justify-center gap-1.5 rounded-md bg-ctp-mauve px-4 py-2.5 active:bg-ctp-mauve/80"
      >
        <MaterialCommunityIcons
          name="download"
          size={16}
          color={downloading ? "#999" : "#ede6f8"}
        />
        <Text className={`text-sm font-medium ${downloading ? "text-ctp-overlay0" : "text-ctp-base"}`}>
          {downloading ? "Downloading…" : `Update to v${updateVersion}`}
        </Text>
      </Pressable>
    ) : null;

  const renderIOSHint = () =>
    Platform.OS !== "android" ? (
      <Text className="text-xs text-ctp-overlay0">
        Automatic updates for iOS are handled via TestFlight / App Store.
      </Text>
    ) : null;

  return (
    <View className="gap-4">
      {/* Header */}
      <View className="flex-row items-center gap-2">
        <Text className="text-lg font-semibold text-ctp-text">About</Text>
      </View>

      <Card>
        <CardContent>
          <View className="gap-3 pt-3">
            {/* Version info */}
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-ctp-subtext0">Version</Text>
              <Text className="text-sm text-ctp-text">Siltflow v{currentVersion}</Text>
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-ctp-subtext0">Platform</Text>
              <Text className="text-sm text-ctp-text">Mobile ({Platform.OS})</Text>
            </View>

            {/* Status */}
            {status ? (
              <View className="flex-row items-start gap-1.5">
                {isError ? (
                  <MaterialCommunityIcons name="alert-circle" size={14} color="#f38ba8" />
                ) : null}
                <Text className={`text-sm flex-1 ${statusColor}`}>
                  {status}
                </Text>
              </View>
            ) : null}

            {/* Progress bar */}
            {downloading ? renderProgress() : null}

            {/* Actions */}
            <View className="flex-row gap-2">
              {/* Check for updates */}
              <Pressable
                onPress={handleCheck}
                disabled={checking}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-md border border-ctp-surface1 bg-transparent px-4 py-2.5 active:bg-ctp-surface0"
              >
                {checking ? <Spinner size="sm" /> : null}
                <Text className="text-sm font-medium text-ctp-text">
                  {checking ? "Checking…" : "Check for Updates"}
                </Text>
              </Pressable>

              {renderUpdateButton()}
            </View>

            {renderIOSHint()}
          </View>
        </CardContent>
      </Card>
    </View>
  );
}
