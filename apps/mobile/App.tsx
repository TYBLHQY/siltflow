import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Siltflow Mobile</Text>
        <StatusBar style="auto" />
      </View>
    </SafeAreaProvider>
  );
}
