/**
 * Tab navigation layout — bottom tab bar + horizontal swipe to
 * switch tabs.
 *
 * Vanilla Slot + custom TabBar. A thin Pan gesture detector on the
 * content area watches for horizontal swipes past a threshold; on
 * release it jumps to the adjacent tab via router.replace().
 *
 * No shared-value animation, no multi-page rendering — the swipe is
 * just a trigger, keeping the implementation simple and free of
 * database concurrency issues or worklet-animation fights.
 */

import { useCallback, useEffect } from "react";
import { Slot, usePathname, useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { View } from "@/tw";
import { TabBar } from "@/components/TabBar";

const ROUTES = ["/review", "/stats", "/settings"];
const SWIPE_THRESHOLD = 80;

export default function TabLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const activeIdx = useSharedValue(ROUTES.indexOf(pathname));

  // Keep the worklet-readable index in sync
  useEffect(() => {
    activeIdx.value = ROUTES.indexOf(pathname);
  }, [pathname, activeIdx]);

  const navigateTo = useCallback(
    (route: string) => router.replace(route as any),
    [router],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .onEnd((event) => {
      "worklet";
      const idx = activeIdx.value;
      const dx = event.translationX;
      if (dx < -SWIPE_THRESHOLD && idx < ROUTES.length - 1) {
        runOnJS(navigateTo)(ROUTES[idx + 1]);
      } else if (dx > SWIPE_THRESHOLD && idx > 0) {
        runOnJS(navigateTo)(ROUTES[idx - 1]);
      }
    });

  return (
    <View className="flex-1">
      <GestureDetector gesture={pan}>
        <View className="flex-1">
          <Slot />
        </View>
      </GestureDetector>
      <TabBar />
    </View>
  );
}
