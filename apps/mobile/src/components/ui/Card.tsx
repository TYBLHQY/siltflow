import { cn } from "@/lib/utils";
import { View, Text } from "@/tw";

export function Card({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <View className={cn("rounded-lg border border-ctp-surface1 bg-ctp-surface0 p-4", className)}>
      {children}
    </View>
  );
}

export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <View className={cn("mb-3 flex-col gap-1", className)}>
      {children}
    </View>
  );
}

export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Text className={cn("text-lg font-semibold text-ctp-text", className)}>
      {children}
    </Text>
  );
}

export function CardDescription({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Text className={cn("text-sm text-ctp-subtext0", className)}>
      {children}
    </Text>
  );
}

export function CardContent({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <View className={cn("flex-col gap-2", className)}>
      {children}
    </View>
  );
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <View className={cn("mt-4 flex-row items-center gap-2", className)}>
      {children}
    </View>
  );
}
