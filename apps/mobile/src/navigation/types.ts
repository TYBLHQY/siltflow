import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";

// ---------------------------------------------------------------------------
// Tab Navigator
// ---------------------------------------------------------------------------

export type TabParamList = {
  DocumentsTab: NavigatorScreenParams<DocumentsStackParamList>;
  ReviewTab: undefined;
  StatsTab: undefined;
  SettingsTab: undefined;
};

// ---------------------------------------------------------------------------
// Documents Stack
// ---------------------------------------------------------------------------

export type DocumentsStackParamList = {
  DocumentList: undefined;
  DocumentDetail: { documentId: string; title: string };
};

// ---------------------------------------------------------------------------
// Screen prop types
// ---------------------------------------------------------------------------

export type DocumentsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "DocumentsTab">,
  NativeStackScreenProps<DocumentsStackParamList>
>;

export type ReviewTabScreenProps = BottomTabScreenProps<TabParamList, "ReviewTab">;
export type StatsTabScreenProps = BottomTabScreenProps<TabParamList, "StatsTab">;
export type SettingsTabScreenProps = BottomTabScreenProps<TabParamList, "SettingsTab">;

export type DocumentListScreenProps = NativeStackScreenProps<DocumentsStackParamList, "DocumentList">;
export type DocumentDetailScreenProps = NativeStackScreenProps<DocumentsStackParamList, "DocumentDetail">;
