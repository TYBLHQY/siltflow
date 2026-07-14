import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, Text, View } from "react-native";
// Polyfill crypto.randomUUID for React Native
import "react-native-get-random-values";
import { initDatabase } from "./src/database";
import { bootStores, useDocumentStore, useFolderStore } from "./src/stores";
import AppNavigator from "./src/navigation/AppNavigator";

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        await bootStores();
        // Pre-load documents and folders
        await Promise.all([
          useDocumentStore.getState().loadFromDb(),
          useFolderStore.getState().loadFolders(),
        ]);
        setReady(true);
      } catch (err: any) {
        console.error("[App] boot error:", err);
        setError(err?.message ?? String(err));
      }
    })();
  }, []);

  if (error) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Text style={{ color: "red", fontSize: 16, textAlign: "center" }}>
            Failed to initialize: {error}
          </Text>
          <StatusBar style="auto" />
        </View>
      </SafeAreaProvider>
    );
  }

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 12, fontSize: 16 }}>Loading Siltflow Mobile…</Text>
          <StatusBar style="auto" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
