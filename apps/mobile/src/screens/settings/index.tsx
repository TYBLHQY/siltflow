/**
 * Settings screen — app settings and sync configuration.
 */

import { ScrollView, View, Text, SafeAreaView } from "@/tw";
import { SyncSettings } from "./SyncSettings";
import { TTSConfig } from "./TTSConfig";

export function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-ctp-base">
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 gap-6 pt-6"
      >
        <SyncSettings />

        <TTSConfig />

        {/* App info footer */}
        <View className="items-center py-4">
          <Text className="text-xs text-ctp-overlay0">Siltflow v0.1.0</Text>
          <Text className="text-xs text-ctp-overlay0">Mobile</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
