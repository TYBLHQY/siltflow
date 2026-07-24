import { Slot } from "expo-router";
import { View } from "@/tw";
import { TabBar } from "@/components/TabBar";

export default function TabLayout() {
  return (
    <View className="flex-1">
      <View className="flex-1">
        <Slot />
      </View>
      <TabBar />
    </View>
  );
}
