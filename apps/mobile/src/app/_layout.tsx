import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import { Appearance, type ColorSchemeName } from "react-native";
import { ThemeProvider } from "@/components/ThemeProvider";
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
    <ThemeProvider>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
