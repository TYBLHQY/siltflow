import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { Text } from "react-native";

import DocumentListScreen from "../screens/DocumentListScreen";
import StatsScreen from "../screens/StatsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import type { TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Review: "📄",
    Stats: "📊",
    Settings: "⚙️",
  };
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>
      {icons[label] ?? "•"}
    </Text>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon label={route.name.replace("Tab", "")} focused={focused} />
          ),
          tabBarActiveTintColor: "#4a90d9",
          tabBarInactiveTintColor: "#999",
          tabBarLabel: route.name.replace("Tab", ""),
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: "#e5e5e5",
          },
        })}
      >
        <Tab.Screen name="ReviewTab" component={DocumentListScreen} />
        <Tab.Screen name="StatsTab" component={StatsScreen} />
        <Tab.Screen name="SettingsTab" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
