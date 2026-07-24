/**
 * Tab navigation layout — bottom tab bar for the main app screens.
 *
 * Uses expo-router Tabs for native tab navigation with
 * a custom-themed TabBar component.
 */

import { Tabs } from "expo-router";
import { TabBar } from "@/components/TabBar";

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="review" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
