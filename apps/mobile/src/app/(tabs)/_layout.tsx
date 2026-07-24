/**
 * Tab navigation layout — bottom tab bar for the main app screens.
 *
 * Vanilla Slot + custom TabBar. No react-navigation Tabs wrapper —
 * route switching is a plain router.replace(), no animation, no
 * gesture conflicts, no extra native navigator nesting.
 */

import { Slot } from "expo-router";
import { View } from "@/tw";
import { TabBar } from "@/components/TabBar";

export default function TabLayout() {
  return (
    <View className="flex-1">
      <View className="flex-1">
        <Slot />
      </View>
      <TabBar />
    </View>
  );
}
