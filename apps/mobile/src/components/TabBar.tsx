/**
 * Custom bottom tab bar — theme-aware via CSS variables.
 *
 * Receives standard React Navigation bottom-tab props from the <Tabs>
 * wrapper in _layout.tsx. Navigates via `navigation.navigate()` so
 * React Navigation's tab state stays in sync.
 *
 * MaterialCommunityIcons need raw hex colors (they don't understand CSS
 * vars), so we track the system appearance and pick from the Catppuccin
 * light/dark color maps. View and Text use Tailwind classes — their colors
 * auto-switch because react-native-css's useCssElement resolves var() refs
 * against the current VariableContext.
 */

import { View, Text, Pressable } from "@/tw";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Appearance } from "react-native";
import { useState, useEffect, useCallback, memo } from "react";
import { darkColors, lightColors } from "@/lib/theme";

// -- Tab bar props (inlined — avoids direct dep on @react-navigation/bottom-tabs) --

interface TabBarProps {
  state: { routes: Array<{ key: string; name: string }>; index: number };
  navigation: { navigate: (name: string) => void };
}

// -- Tab definition ------------------------------------------------------

interface TabItem {
  label: string;
  route: string;
  icon: string;          // unfocused
  iconFocused: string;   // focused
}

const TABS: TabItem[] = [
  { label: "Review", route: "review", icon: "cards-outline", iconFocused: "cards" },
  { label: "Stats", route: "stats", icon: "chart-bar", iconFocused: "chart-bar" },
  { label: "Settings", route: "settings", icon: "cog-outline", iconFocused: "cog" },
];

// -- Component ------------------------------------------------------------

export function TabBar({ state, navigation }: TabBarProps) {
  const scheme = useColorScheme();

  return (
    <View className="flex-row border-t border-ctp-surface0 bg-ctp-crust pb-[20px] pt-2">
      {TABS.map((tab) => {
        const route = state.routes.find((r) => r.name === tab.route);
        if (!route) return null;

        const active = state.index === state.routes.indexOf(route);

        return (
          <TabBarItem
            key={route.key}
            tab={tab}
            active={active}
            onPress={() => navigation.navigate(tab.route)}
            scheme={scheme}
          />
        );
      })}
    </View>
  );
}

interface TabBarItemProps {
  tab: TabItem;
  active: boolean;
  onPress: () => void;
  scheme: "light" | "dark";
}

const TabBarItem = memo(function TabBarItem({
  tab,
  active,
  onPress,
  scheme,
}: TabBarItemProps) {
  // Use a stable callback to avoid re-rendering children on each tab press
  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  return (
    <Pressable
      className="flex-1 items-center justify-center gap-0.5 py-1"
      onPress={handlePress}
    >
      <TabIcon
        name={active ? tab.iconFocused : tab.icon}
        colorKey={active ? "blue" : "overlay0"}
        scheme={scheme}
      />
      <TabLabel text={tab.label} active={active} />
    </Pressable>
  );
});

// -- Icon (raw hex — MaterialCommunityIcons doesn't do CSS vars) -----------

const ICON_SIZE = 24;

const TabIcon = memo(function TabIcon({
  name,
  colorKey,
  scheme,
}: {
  name: string;
  colorKey: string;
  scheme: "light" | "dark";
}) {
  const colors = scheme === "dark" ? darkColors : lightColors;
  const color = colors[`--ctp-${colorKey}`] ?? colors["--ctp-text"] ?? "#000";

  return (
    <MaterialCommunityIcons name={name as any} size={ICON_SIZE} color={color} />
  );
});

// -- Label (Tailwind class — auto-switches via CSS vars) -------------------

const TabLabel = memo(function TabLabel({
  text,
  active,
}: {
  text: string;
  active: boolean;
}) {
  return (
    <Text
      className={`text-[10px] ${active ? "text-ctp-blue" : "text-ctp-overlay0"}`}
    >
      {text}
    </Text>
  );
});

// -- Shared theme subscription (one listener for the whole tab bar) --------

/**
 * Returns the current light/dark scheme.
 * A single listener shared by all tab bar children — avoids each icon
 * subscribing to Appearance individually.
 */
function useColorScheme(): "light" | "dark" {
  const [scheme, setScheme] = useState<"light" | "dark">(
    () => (Appearance.getColorScheme() as "light" | "dark") ?? "light",
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme((colorScheme as "light" | "dark") ?? "light");
    });
    return () => sub.remove();
  }, []);

  return scheme;
}
