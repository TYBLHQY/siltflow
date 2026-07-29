/**
 * Navigation animation config panel (mobile).
 *
 * Shows current selection + a bottom-sheet modal for picking
 * a Stack transition animation from react-native-screens.
 *
 * Uses animationType="fade" on the Modal so the backdrop fades in
 * uniformly instead of sliding up with the sheet.
 */

import { useState } from "react";
import { Modal, TouchableWithoutFeedback } from "react-native";
import { View, Text, Pressable } from "@/tw";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Card, CardContent } from "@/components/ui";
import { useSettingsStore, type StackAnimation } from "@/stores/settings.store";

const ANIMATION_OPTIONS: { value: StackAnimation; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "simple_push", label: "Simple Push" },
  { value: "slide_from_right", label: "Slide Right" },
  { value: "slide_from_bottom", label: "Slide Bottom" },
  { value: "flip", label: "Flip" },
  { value: "slide_from_left", label: "Slide Left" },
];

function currentLabel(value: string): string {
  return ANIMATION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function PickerSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (v: StackAnimation) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Backdrop — fades in with animationType="fade" */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View
            className="flex-1"
            style={{ backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          >
            {/* Sheet body — stop propagation to backdrop */}
            <TouchableWithoutFeedback>
              <View className="rounded-t-2xl bg-ctp-base px-4 pt-4 pb-8">
                {/* Drag handle */}
                <View className="items-center mb-3">
                  <View
                    className="w-10 rounded-full"
                    style={{ height: 4, backgroundColor: "rgba(128,128,128,0.4)" }}
                  />
                </View>

                <Text className="text-base font-semibold text-ctp-text mb-3 px-2">
                  Page Transition Animation
                </Text>

                {ANIMATION_OPTIONS.map((opt) => {
                  const isSelected = opt.value === selected;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        onSelect(opt.value);
                        onClose();
                      }}
                      className="flex-row items-center justify-between px-4 py-3 rounded-lg active:bg-ctp-surface0"
                    >
                      <Text
                        className={`text-base ${isSelected ? "font-semibold text-ctp-mauve" : "text-ctp-text"}`}
                      >
                        {opt.label}
                      </Text>
                      {isSelected ? (
                        <MaterialCommunityIcons name="check" size={20} color="#c4a1e0" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </GestureHandlerRootView>
    </Modal>
  );
}

export function AnimationConfig() {
  const animation = useSettingsStore((s) => s.animation);
  const setAnimation = useSettingsStore((s) => s.setAnimation);
  const [visible, setVisible] = useState(false);

  return (
    <View className="gap-4">
      {/* Header */}
      <View className="flex-row items-center gap-2">
        <Text className="text-lg font-semibold text-ctp-text">Animation</Text>
      </View>

      <Card>
        <CardContent>
          <View className="gap-3 pt-3">
            <Text className="text-xs text-ctp-subtext0">
              Page transition effect when navigating between screens.
            </Text>

            {/* Current selection — press to open picker */}
            <Pressable
              onPress={() => setVisible(true)}
              className="flex-row items-center justify-between rounded-md border border-ctp-surface1 bg-transparent px-4 py-3 active:bg-ctp-surface0"
            >
              <Text className="text-base text-ctp-text">{currentLabel(animation)}</Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#7b7f8a" />
            </Pressable>
          </View>
        </CardContent>
      </Card>

      <PickerSheet
        visible={visible}
        selected={animation}
        onSelect={(v) => setAnimation(v)}
        onClose={() => setVisible(false)}
      />
    </View>
  );
}
