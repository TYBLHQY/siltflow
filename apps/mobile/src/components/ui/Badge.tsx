import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { View, Text } from "@/tw";

const badgeVariants = cva(
  "inline-flex items-center self-start rounded-full px-2.5 py-0.5",
  {
    variants: {
      variant: {
        default: "bg-ctp-blue/15",
        secondary: "bg-ctp-surface1",
        outline: "border border-ctp-surface1 bg-transparent",
        destructive: "bg-ctp-red/15",
        success: "bg-ctp-green/15",
        warning: "bg-ctp-yellow/15",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const textVariants = cva("text-xs font-medium", {
  variants: {
    variant: {
      default: "text-ctp-blue",
      secondary: "text-ctp-text",
      outline: "text-ctp-text",
      destructive: "text-ctp-red",
      success: "text-ctp-green",
      warning: "text-ctp-yellow",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string;
  children?: React.ReactNode;
}

export function Badge({ className, variant, children }: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant }), className)}>
      {typeof children === "string" ? (
        <Text className={textVariants({ variant })}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}
