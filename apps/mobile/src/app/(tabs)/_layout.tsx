/**
 * Tab navigation layout — bottom tab bar for the main app screens.
 *
 * Supports horizontal swipe to switch tabs: swiping left goes to the
 * next tab (rightwards in the tab order), swiping right goes back.
 *
 * Completely replaces expo-router's Tabs/TabList/TabTrigger with our
 * own implementation using Slot + custom TabBar + swipe gesture.
 */

import { Slot, usePathname, useRouter } from "expo-router";
import { useCallback } from "react";
import { View } from "@/tw";
import { TabBar } from "@/components/TabBar";
import { SwipeTabView } from "@/components/SwipeTabView";

export default function TabLayout() {
  const pathname = usePathname();
  const router = useRouter();

  const handleTabChange = useCallback(
    (route: string) => {
      router.replace(route as any);
    },
    [router],
  );

  return (
    <View className="flex-1">
      {/* Swipeable content area */}
      <SwipeTabView activeRoute={pathname} onTabChange={handleTabChange}>
        <View className="flex-1">
          <Slot />
        </View>
      </SwipeTabView>

      {/* Theme-aware bottom tab bar */}
      <TabBar />
    </View>
  );
}
