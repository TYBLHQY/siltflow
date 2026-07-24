/**
 * Tab navigation layout — bottom tab bar for the main app screens.
 *
 * Completely replaces expo-router's Tabs/TabList/TabTrigger with our
 * own implementation. We use a vertical flex layout: Slot for the
 * active route on top, custom theme-aware TabBar on the bottom.
 *
 * Why not use expo-router's built-in Tabs?
 *   TabList and TabTrigger only accept inline style objects (hardcoded
 *   hex colors) — they never pass through react-native-css's
 *   useCssElement hook, so Catppuccin theme variable changes from
 *   VariableContextProvider are invisible to them.
 *
 * With this custom approach:
 *   - View/Text use Tailwind classes → auto-switch with theme
 *   - MaterialCommunityIcons get raw hex from Appearance listener
 */

import { Slot } from "expo-router";
import { View } from "@/tw";
import { TabBar } from "@/components/TabBar";

export default function TabLayout() {
  return (
    <View className="flex-1">
      {/* Route content — fills remaining space above tab bar */}
      <View className="flex-1">
        <Slot />
      </View>

      {/* Theme-aware bottom tab bar */}
      <TabBar />
    </View>
  );
}
