import { View, Text } from "@/tw";
import { Link } from "expo-router";
import { Button } from "@/components/ui";

export function Home() {
  return (
    <View className="flex-1 items-center justify-center gap-6 bg-ctp-base px-8">
      <Text className="text-xl font-bold text-ctp-text">Siltflow Mobile</Text>
      <Text className="text-ctp-subtext0">Development preview</Text>
      <Link href="/kitchen-sink" asChild>
        <Button variant="outline">Component Kitchen Sink</Button>
      </Link>
    </View>
  );
}
