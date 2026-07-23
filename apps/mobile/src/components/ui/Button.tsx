import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Pressable, Text } from "@/tw";
import { ActivityIndicator } from "react-native";

const buttonVariants = cva(
  "flex-row items-center justify-center gap-2 rounded-md",
  {
    variants: {
      variant: {
        primary: "bg-ctp-blue active:opacity-80",
        destructive: "bg-ctp-red active:opacity-80",
        outline: "border border-ctp-surface1 bg-transparent active:bg-ctp-surface0",
        secondary: "bg-ctp-surface0 active:opacity-80",
        ghost: "bg-transparent active:bg-ctp-surface0",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4 py-2",
        lg: "h-12 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

const textVariants = cva("font-medium", {
  variants: {
    variant: {
      primary: "text-ctp-base",
      destructive: "text-ctp-base",
      outline: "text-ctp-text",
      secondary: "text-ctp-text",
      ghost: "text-ctp-text",
    },
    size: { sm: "text-sm", md: "text-base", lg: "text-lg", icon: "text-base" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export interface ButtonProps extends VariantProps<typeof buttonVariants> {
  className?: string;
  textClassName?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
}

export function Button({
  className, textClassName, variant, size,
  loading, disabled, onPress, children,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      className={cn(
        buttonVariants({ variant, size }),
        isDisabled && "opacity-50",
        className,
      )}
      onPress={onPress}
      disabled={isDisabled ?? false}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={
            variant === "outline" || variant === "secondary" || variant === "ghost"
              ? undefined
              : "#ffffff"
          }
        />
      )}
      {typeof children === "string" ? (
        <Text className={cn(textVariants({ variant, size }), textClassName)}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export { buttonVariants };
