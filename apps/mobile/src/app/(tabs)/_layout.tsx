/**
 * Tab navigation layout — bottom tab bar for the main app screens.
 *
 * Expo Router (tabs) layout using headless Tabs pattern with
 * TabList + TabTrigger for each tab. Unicode emoji icons are used
 * instead of SVG (react-native-svg has Fabric incompatibility).
 */

import { Tabs, TabList, TabSlot, TabTrigger } from "expo-router/ui";
import { Text } from "@/tw";

export default function TabLayout() {
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
          name="documents"
          href="/documents"
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <Text style={{ fontSize: 22 }}>📄</Text>
          <Text style={{ fontSize: 10, color: "#cdd6f4" }}>Documents</Text>
        </TabTrigger>

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
          <Text style={{ fontSize: 22 }}>📚</Text>
          <Text style={{ fontSize: 10, color: "#cdd6f4" }}>Review</Text>
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
          <Text style={{ fontSize: 22 }}>📊</Text>
          <Text style={{ fontSize: 10, color: "#cdd6f4" }}>Stats</Text>
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
          <Text style={{ fontSize: 22 }}>⚙️</Text>
          <Text style={{ fontSize: 10, color: "#cdd6f4" }}>Settings</Text>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
