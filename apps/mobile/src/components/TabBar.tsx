/**
 * Custom bottom tab bar — theme-aware via CSS variables.
 *
 * MaterialCommunityIcons need raw hex colors (they don't understand CSS
 * vars), so we track the system appearance and pick from the Catppuccin
 * light/dark color maps. View and Text use Tailwind classes — their colors
 * auto-switch because react-native-css's useCssElement resolves var() refs
 * against the current VariableContext.
 */

import { View, Text, Pressable } from "@/tw";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Appearance } from "react-native";
import { useState, useEffect } from "react";
import { darkColors, lightColors } from "@/lib/theme";

// -- Tab definition ------------------------------------------------------

interface TabItem {
  label: string;
  route: string;
  icon: string;          // unfocused
  iconFocused: string;   // focused
}

const TABS: TabItem[] = [
  { label: "Review", route: "/review", icon: "cards-outline", iconFocused: "cards" },
  { label: "Stats", route: "/stats", icon: "chart-bar", iconFocused: "chart-bar" },
  { label: "Settings", route: "/settings", icon: "cog-outline", iconFocused: "cog" },
];

// -- Component ------------------------------------------------------------

export function TabBar() {
  return (
    <View className="flex-row border-t border-ctp-surface0 bg-ctp-crust pb-[20px] pt-2">
      {TABS.map((tab) => (
        <TabBarItem key={tab.route} tab={tab} />
      ))}
    </View>
  );
}

function TabBarItem({ tab }: { tab: TabItem }) {
  const pathname = usePathname();
  const router = useRouter();

  // Active if the pathname equals the route or starts with route + "/"
  const active = pathname === tab.route || pathname.startsWith(tab.route + "/");

  return (
    <Pressable
      className="flex-1 items-center justify-center gap-0.5 py-1"
      onPress={() => {
        // Prevent double-tap crash when already on the tab
        if (!active) router.replace(tab.route as any);
      }}
    >
      <TabIcon name={active ? tab.iconFocused : tab.icon} active={active} />
      <TabLabel text={tab.label} active={active} />
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

/**
 * Returns the current Catppuccin color hex for a given token.
 * Listens to system appearance changes so the icon re-renders
 * when the user toggles light/dark mode.
 */
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

  const colors = scheme === "dark" ? darkColors : lightColors;
  return colors[`--ctp-${key}`] ?? colors["--ctp-text"] ?? "#000";
}
