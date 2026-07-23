import { cn } from "@/lib/utils";
import { View, Text, TextInput as TwTextInput } from "@/tw";
import { useState, type ComponentProps } from "react";

export interface InputProps extends Omit<ComponentProps<typeof TwTextInput>, "className"> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export function Input({
  label, error, hint, containerClassName, editable = true, ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;
  const isDisabled = editable === false;

  return (
    <View className={cn("flex-col gap-1", containerClassName)}>
      {label && (
        <Text className={cn(
          "text-sm font-medium text-ctp-subtext1",
          hasError && "text-ctp-red",
          isDisabled && "opacity-50",
        )}>
          {label}
        </Text>
      )}
      <TwTextInput
        className={cn(
          "rounded-md border bg-ctp-base px-3 py-2 text-base text-ctp-text",
          focused ? "border-ctp-blue"
            : hasError ? "border-ctp-red"
            : "border-ctp-surface1",
          isDisabled && "opacity-50",
        )}
        editable={editable}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        placeholderTextColor="var(--ctp-overlay1)"
        {...props}
      />
      {error && <Text className="text-sm text-ctp-red">{error}</Text>}
      {hint && !error && <Text className="text-sm text-ctp-overlay1">{hint}</Text>}
    </View>
  );
}
