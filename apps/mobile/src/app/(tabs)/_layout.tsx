/**
 * Tab navigation layout — bottom tab bar for the main app screens.
 *
 * Uses expo-router's Tabs component (react-navigation bottom-tabs)
 * with a custom tabBar. React Navigation handles tab switching
 * natively — no JS-driven pan-gesture animation conflicts.
 *
 * Each screen is lazy-rendered (only mounted when first visited) and
 * detaches when inactive, so we don't hold three database connections
 * open simultaneously.
 */

import { Tabs } from "expo-router";
import { TabBar } from "@/components/TabBar";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props as any} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
        animation: "fade",
      }}
    >
      <Tabs.Screen name="review" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
