/**
 * Custom bottom tab bar — theme-aware via CSS variables.
 *
 * Designed to be passed as the `tabBar` prop to expo-router's Tabs
 * component (which is react-navigation's bottom-tabs navigator).
 *
 * Receives `BottomTabBarProps` from react-navigation so tab presses
 * go through the navigator's state machine rather than raw router.replace().
 */

import { View, Text, Pressable } from "@/tw";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Appearance } from "react-native";
import { useState, useEffect } from "react";

// -- Minimal types (react-navigation's BottomTabBarProps subset) ----------

interface TabBarNavigationState {
  index: number;
  routes: Array<{ key: string; name: string }>;
}

interface TabBarNavigation {
  emit: (event: { type: string; target: string; canPreventDefault?: boolean }) => { defaultPrevented?: boolean };
  navigate: (name: string) => void;
}

interface TabBarProps {
  state: TabBarNavigationState;
  navigation: TabBarNavigation;
}

// -- Tab definition ------------------------------------------------------

interface TabDef {
  route: string;
  label: string;
  icon: string;
  iconFocused: string;
}

const TABS: TabDef[] = [
  { route: "review",  label: "Review",   icon: "cards-outline", iconFocused: "cards" },
  { route: "stats",   label: "Stats",    icon: "chart-bar",     iconFocused: "chart-bar" },
  { route: "settings",label: "Settings", icon: "cog-outline",   iconFocused: "cog" },
];

// -- Component ------------------------------------------------------------

export function TabBar({ state, navigation }: TabBarProps) {
  return (
    <View className="flex-row border-t border-ctp-surface0 bg-ctp-crust pb-[20px] pt-2">
      {TABS.map((tab, idx) => {
        const route = state.routes[idx];
        const focused = state.index === idx;
        return (
          <TabBarItem
            key={tab.route}
            tab={tab}
            focused={focused}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(tab.route);
              }
            }}
          />
        );
      })}
    </View>
  );
}

function TabBarItem({
  tab,
  focused,
  onPress,
}: {
  tab: TabDef;
  focused: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="flex-1 items-center justify-center gap-0.5 py-1"
      onPress={onPress}
    >
      <TabIcon name={focused ? tab.iconFocused : tab.icon} active={focused} />
      <TabLabel text={tab.label} active={focused} />
    </Pressable>
  );
}

// -- Icon (raw hex — MaterialCommunityIcons doesn't do CSS vars) -----------

const ICON_SIZE = 24;

function TabIcon({ name, active }: { name: string; active: boolean }) {
  const color = useThemeColor(active ? "blue" : "overlay0");
  return (
    <MaterialCommunityIcons
      name={name as any}
      size={ICON_SIZE}
      color={color}
    />
  );
}

// -- Label (Tailwind class — auto-switches via CSS vars) -------------------

function TabLabel({ text, active }: { text: string; active: boolean }) {
  return (
    <Text className={`text-[10px] ${active ? "text-ctp-blue" : "text-ctp-overlay0"}`}>
      {text}
    </Text>
  );
}

// -- Theme color helper ---------------------------------------------------

function useThemeColor(key: string): string {
  const [scheme, setScheme] = useState(
    () => Appearance.getColorScheme() ?? "light",
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme ?? "light");
    });
    return () => sub.remove();
  }, []);

  const { darkColors, lightColors } = require("@/lib/theme");
  const colors = scheme === "dark" ? darkColors : lightColors;
  return colors[`--ctp-${key}`] ?? colors["--ctp-text"] ?? "#000";
}
