import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

export type TabParamList = {
  DocumentsTab: undefined;
  StatsTab: undefined;
  SettingsTab: undefined;
};

export type DocumentsScreenProps = BottomTabScreenProps<TabParamList, "DocumentsTab">;
export type StatsTabScreenProps = BottomTabScreenProps<TabParamList, "StatsTab">;
export type SettingsTabScreenProps = BottomTabScreenProps<TabParamList, "SettingsTab">;
