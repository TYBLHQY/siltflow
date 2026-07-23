import { View, Text, SafeAreaView } from "@/tw";

export default function StudyTab() {
  return (
    <SafeAreaView className="flex-1 bg-ctp-base">
      <View className="flex-1 items-center justify-center px-8 gap-4">
        <Text className="text-5xl">📚</Text>
        <Text className="text-xl font-bold text-ctp-text">Study</Text>
        <Text className="text-ctp-subtext0 text-center">
          Flashcard review and spaced repetition will appear here.
        </Text>
      </View>
    </SafeAreaView>
  );
}
