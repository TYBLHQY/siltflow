/**
 * Settings screen — app settings and sync configuration.
 */

import { ScrollView, View, Text, SafeAreaView } from "@/tw";
import { SyncSettings } from "./SyncSettings";
import { AnimationConfig } from "./AnimationConfig";
import { TTSConfig } from "./TTSConfig";
import { UpdateConfig } from "./UpdateConfig";
import { ServerUpdateConfig } from "./ServerUpdateConfig";

export function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-ctp-base">
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 gap-6 pt-6"
      >
        <SyncSettings />

        <ServerUpdateConfig />

        <AnimationConfig />

        <TTSConfig />

        <UpdateConfig />

        {/* App info footer */}
        <View className="items-center py-4">
          <Text className="text-xs text-ctp-overlay0">Mobile</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
