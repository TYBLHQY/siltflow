/**
 * Sync configuration and control screen.
 * Allows the user to connect to a desktop sync server and synchronize data.
 */
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SyncClient } from "./client";

export default function SyncScreen() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("53891");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [client, setClient] = useState<SyncClient | null>(null);
  const [syncResult, setSyncResult] = useState<string>("");

  const handleConnect = useCallback(async () => {
    if (!host.trim()) {
      Alert.alert("Error", "Please enter the desktop IP address");
      return;
    }

    setLoading(true);
    setStatus("Connecting…");
    setSyncResult("");

    try {
      const c = new SyncClient(host.trim(), parseInt(port, 10) || 53891);
      const ok = await c.checkConnection();
      if (ok) {
        const state = await c.getServerState();
        setClient(c);
        setConnected(true);
        setStatus(
          `Connected! Server time: ${state.serverTime || "unknown"}`,
        );
      } else {
        setStatus("Connection failed — check IP and port");
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [host, port]);

  const handleSync = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setStatus("Syncing…");
    setSyncResult("");

    try {
      const result = await client.fullSync();
      const parts: string[] = [];
      if (result.pull) {
        for (const [k, v] of Object.entries(result.pull)) {
          parts.push(`${k}: ${v}`);
        }
      }
      setConnected(false);
      setClient(null);
      setSyncResult(
        `Sync complete!\n\nDownloaded:\n${parts.join("\n")}`,
      );
      setStatus("");
      Alert.alert("Sync Complete", parts.join("\n"));
    } catch (err: any) {
      setStatus(`Sync error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [client]);

  const handleDisconnect = useCallback(() => {
    setClient(null);
    setConnected(false);
    setStatus("Disconnected");
    setSyncResult("");
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sync with Desktop</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!connected ? (
          <>
            <Text style={styles.label}>Desktop IP Address</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 192.168.1.100"
              value={host}
              onChangeText={setHost}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Port</Text>
            <TextInput
              style={styles.input}
              placeholder="53891"
              value={port}
              onChangeText={setPort}
              keyboardType="number-pad"
            />

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#4a90d9" }]}
              onPress={handleConnect}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Connect</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.connectedBanner}>
              <Text style={styles.connectedIcon}>✅</Text>
              <Text style={styles.connectedText}>
                Connected to {host}:{port}
              </Text>
            </View>

            <Text style={styles.infoText}>
              Data will be synced between desktop and mobile.
            </Text>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#4caf50" }]}
              onPress={handleSync}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Start Sync</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#e74c3c", marginTop: 8 }]}
              onPress={handleDisconnect}
              disabled={loading}
            >
              <Text style={styles.btnText}>Disconnect</Text>
            </TouchableOpacity>
          </>
        )}

        {status ? (
          <Text style={styles.status}>{status}</Text>
        ) : null}

        {syncResult ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>{syncResult}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#e5e5e5",
  },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  scroll: { padding: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#555", marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  connectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  connectedIcon: { fontSize: 20, marginRight: 10 },
  connectedText: { fontSize: 15, fontWeight: "600", color: "#2e7d32" },
  infoText: { fontSize: 14, color: "#777", marginBottom: 8 },
  status: { fontSize: 14, color: "#666", marginTop: 12, textAlign: "center" },
  resultBox: {
    backgroundColor: "#f0f4ff",
    padding: 16,
    borderRadius: 10,
    marginTop: 12,
  },
  resultText: { fontSize: 13, color: "#333", lineHeight: 20 },
});
