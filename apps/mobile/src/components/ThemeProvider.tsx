import { useState, useEffect } from "react";
import { Appearance, type ColorSchemeName } from "react-native";
import { VariableContextProvider } from "react-native-css";
import { lightColors, darkColors } from "@/lib/theme";

/**
 * Injects Catppuccin CSS variable values at runtime via react-native-css.
 *
 * Uses Appearance.getColorScheme() + addChangeListener directly instead of
 * useColorScheme() because on Huawei EMUI 12 the change listener may not
 * fire on first subscribe, and useColorScheme() returns null initially.
 *
 * Latte is the default (used during the initial render before
 * Appearance resolves, and when the scheme is unknown).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorScheme, setColorScheme] = useState<ColorSchemeName>(
    () => Appearance.getColorScheme() ?? "light",
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme: next }) => {
      setColorScheme(next);
    });
    return () => sub.remove();
  }, []);

  const vars = colorScheme === "dark" ? darkColors : lightColors;

  return (
    <VariableContextProvider value={vars}>
      {children}
    </VariableContextProvider>
  );
}
