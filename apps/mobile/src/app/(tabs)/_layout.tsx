/**
 * Tab navigation layout — bottom tab bar for the main app screens.
 *
 * Uses expo-router Tabs for native tab navigation with
 * a custom-themed TabBar component.
 */

import { useCallback } from "react";
import { Tabs } from "expo-router";
import { TabBar } from "@/components/TabBar";

export default function TabLayout() {
  const renderTabBar = useCallback(
    (props: any) => <TabBar {...props} />,
    [],
  );

  return (
    <Tabs tabBar={renderTabBar} screenOptions={{ headerShown: false, lazy: true }}>
      <Tabs.Screen name="review" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
