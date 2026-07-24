/**
 * Tab navigation layout — bottom tab bar for the main app screens.
 *
 * SwipeTabView renders all three screens side-by-side with horizontal
 * swipe-to-switch-tab animation. TabBar at the bottom for tap navigation.
 *
 * No expo-router Tabs/TabList/TabTrigger — Slot is replaced by SwipeTabView
 * which renders the screen components directly.
 */

import { usePathname, useRouter } from "expo-router";
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
      {/* Swipeable content area — renders all three screens */}
      <SwipeTabView activeRoute={pathname} onTabChange={handleTabChange} />

      {/* Theme-aware bottom tab bar */}
      <TabBar />
    </View>
  );
}
