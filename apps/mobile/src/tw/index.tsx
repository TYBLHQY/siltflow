import { useCssElement } from "react-native-css";
import type { ComponentProps, ComponentType } from "react";
import {
  View as RNView,
  Text as RNText,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  TextInput as RNTextInput,
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

function tw<
  T extends ComponentType<any>,
  P extends ComponentProps<T> & { className?: string },
>(Component: T, props: P, options: Parameters<typeof useCssElement>[2]) {
  return useCssElement(Component, props, options);
}

export function View(
  props: ComponentProps<typeof RNView> & { className?: string }
) {
  return tw(RNView, props, { className: "style" });
}
View.displayName = "CSS(View)";

export function Text(
  props: ComponentProps<typeof RNText> & { className?: string }
) {
  return tw(RNText, props, { className: "style" });
}
Text.displayName = "CSS(Text)";

export function Pressable(
  props: ComponentProps<typeof RNPressable> & { className?: string }
) {
  return tw(RNPressable, props, { className: "style" });
}
Pressable.displayName = "CSS(Pressable)";

export function ScrollView(
  props: ComponentProps<typeof RNScrollView> & {
    className?: string;
    contentContainerClassName?: string;
  }
) {
  return tw(RNScrollView, props, {
    className: "style",
    contentContainerClassName: "contentContainerStyle",
  });
}
ScrollView.displayName = "CSS(ScrollView)";

export function TextInput(
  props: ComponentProps<typeof RNTextInput> & { className?: string }
) {
  return tw(RNTextInput, props, { className: "style" });
}
TextInput.displayName = "CSS(TextInput)";

export function SafeAreaView(
  props: ComponentProps<typeof RNSafeAreaView> & { className?: string }
) {
  return tw(RNSafeAreaView, props, { className: "style" });
}
SafeAreaView.displayName = "CSS(SafeAreaView)";
