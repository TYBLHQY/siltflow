import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import { Appearance, type ColorSchemeName } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DatabaseProvider } from "@/providers/DatabaseProvider";
import { SyncProvider } from "@/providers/SyncProvider";
import "@/global.css";

export default function RootLayout() {
  const [colorScheme, setColorScheme] = useState<ColorSchemeName>(
    () => Appearance.getColorScheme() ?? "light",
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme: next }) => {
      setColorScheme(next);
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        <DatabaseProvider>
          <SyncProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </SyncProvider>
        </DatabaseProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
