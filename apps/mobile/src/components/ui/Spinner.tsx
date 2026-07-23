import { ActivityIndicator } from "react-native";
import { View, Text } from "@/tw";
import { cn } from "@/lib/utils";

const sizeMap = {
  sm: "small" as const,
  md: "small" as const,
  lg: "large" as const,
};

export function Spinner({
  size = "md",
  className,
  label,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  return (
    <View className={cn("flex-col items-center justify-center gap-2", className)}>
      <ActivityIndicator size={sizeMap[size]} />
      {label && (
        <Text className="text-sm text-ctp-subtext1">{label}</Text>
      )}
    </View>
  );
}
