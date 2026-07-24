/**
 * Toast — themed inline-notification dropped from the top.
 *
 * Each toast auto-dismisses after 3s (controlled by the store).
 * Error toasts use red tones; info toasts use blue tones.
 *
 * Uses Animated for a gentle slide-down entrance — no animation
 * library dependency beyond react-native core.
 */

import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { View, Text } from "@/tw";
import { useToastStore, type Toast as ToastType } from "@/stores/toast.store";

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <View className="absolute top-0 left-4 right-4 z-50 gap-2 pt-[60px]">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

function ToastItem({ toast }: { toast: ToastType }) {
  const dismissToast = useToastStore((s) => s.dismissToast);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    // Slide down from top
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Slide back up just before dismiss
    const slideOutTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        dismissToast(toast.id);
      });
    }, 2700); // 3000ms total — leave 300ms for the slide-out animation

    return () => clearTimeout(slideOutTimer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isError = toast.type === "error";

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
      }}
    >
      <View
        className={`rounded-xl px-4 py-3 shadow-lg ${
          isError
            ? "bg-ctp-red/90 border border-ctp-red/30"
            : "bg-ctp-blue/90 border border-ctp-blue/30"
        }`}
      >
        <Text
          className="text-sm font-medium text-white text-center"
          numberOfLines={2}
        >
          {toast.message}
        </Text>
      </View>
    </Animated.View>
  );
}
