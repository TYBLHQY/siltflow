import { View, Text } from "@/tw";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  className?: string;
}) {
  return (
    <View className={cn("flex-1 items-center justify-center px-8 py-12", className)}>
      <Text className="text-lg font-semibold text-ctp-text">{title}</Text>
      {description && (
        <Text className="mt-2 text-center text-sm text-ctp-subtext0">
          {description}
        </Text>
      )}
      {action && (
        <View className="mt-6">
          <Button variant="primary" onPress={action.onPress}>
            {action.label}
          </Button>
        </View>
      )}
    </View>
  );
}
