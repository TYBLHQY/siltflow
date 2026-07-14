import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

export type TabParamList = {
  ReviewTab: undefined;
  StatsTab: undefined;
  SettingsTab: undefined;
};

export type ReviewTabScreenProps = BottomTabScreenProps<TabParamList, "ReviewTab">;
export type StatsTabScreenProps = BottomTabScreenProps<TabParamList, "StatsTab">;
export type SettingsTabScreenProps = BottomTabScreenProps<TabParamList, "SettingsTab">;
