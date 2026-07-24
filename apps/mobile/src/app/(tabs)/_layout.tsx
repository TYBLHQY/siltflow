/**
 * Tab navigation layout — bottom tab bar for the main app screens.
 *
 * Expo Router (tabs) layout using headless Tabs pattern with
 * TabList + TabTrigger for each tab. Icons use MaterialCommunityIcons
 * from @expo/vector-icons (Material Design style).
 */

import { Tabs, TabList, TabSlot, TabTrigger } from "expo-router/ui";
import { Text } from "@/tw";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export const unstable_settings = {
  initialRouteName: "review",
};

export default function TabLayout() {
  const SIZE = 24;
  const INACTIVE = "#6c7086"; // ctp-overlay0
  return (
    <Tabs>
      <TabSlot />
      <TabList
        style={{
          flexDirection: "row",
          backgroundColor: "#1e1e2e",
          borderTopWidth: 1,
          borderTopColor: "#313244",
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
            color={INACTIVE}
          />
          <Text style={{ fontSize: 10, color: INACTIVE }}>Review</Text>
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
            color={INACTIVE}
          />
          <Text style={{ fontSize: 10, color: INACTIVE }}>Stats</Text>
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
            color={INACTIVE}
          />
          <Text style={{ fontSize: 10, color: INACTIVE }}>Settings</Text>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
