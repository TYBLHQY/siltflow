/**
 * Tab navigation layout — bottom tab bar for the main app screens.
 *
 * Expo Router (tabs) layout using headless Tabs pattern with
 * TabList + TabTrigger for each tab. Icons use MaterialCommunityIcons
 * from @expo/vector-icons (Material Design style).
 *
 * Colours adapt to light/dark mode via Catppuccin tokens:
 *   - Tab bar background: ctp-mantle (slightly darker than base)
 *   - Tab bar border:     ctp-surface0
 *   - Active tab:         ctp-blue
 *   - Inactive tab:       ctp-overlay0
 */

import { Tabs, TabList, TabSlot, TabTrigger } from "expo-router/ui";
import { Text } from "@/tw";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";

// Catppuccin Latte (light) / Mocha (dark) token sets for tabs
const COLORS = {
  light: {
    bg: "#e6e9ef",        // mantle
    border: "#ccd0da",    // surface0
    active: "#1e66f5",    // blue
    inactive: "#9ca0b0",  // overlay0
  },
  dark: {
    bg: "#181825",        // mantle
    border: "#313244",    // surface0
    active: "#89b4fa",    // blue
    inactive: "#6c7086",  // overlay0
  },
} as const;

export const unstable_settings = {
  initialRouteName: "review",
};

export default function TabLayout() {
  const scheme = useColorScheme();
  const c = scheme === "light" ? COLORS.light : COLORS.dark;

  const SIZE = 24;

  return (
    <Tabs>
      <TabSlot />
      <TabList
        style={{
          flexDirection: "row",
          backgroundColor: c.bg,
          borderTopWidth: 1,
          borderTopColor: c.border,
          paddingBottom: 20, // safe area for home indicator
          paddingTop: 8,
        }}
      >
        <TabTrigger
          name="review"
          href="/review"
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <MaterialCommunityIcons
            name="cards-outline"
            size={SIZE}
            color={c.inactive}
          />
          <Text style={{ fontSize: 10, color: c.inactive }}>Review</Text>
        </TabTrigger>

        <TabTrigger
          name="stats"
          href="/stats"
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <MaterialCommunityIcons
            name="chart-bar"
            size={SIZE}
            color={c.inactive}
          />
          <Text style={{ fontSize: 10, color: c.inactive }}>Stats</Text>
        </TabTrigger>

        <TabTrigger
          name="settings"
          href="/settings"
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <MaterialCommunityIcons
            name="cog-outline"
            size={SIZE}
            color={c.inactive}
          />
          <Text style={{ fontSize: 10, color: c.inactive }}>Settings</Text>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
