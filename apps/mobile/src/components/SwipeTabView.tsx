/**
 * SwipeTabView — horizontally paginated tab container.
 *
 * Renders all three tab screens side-by-side in a single row at
 * screen width. A Reanimated shared value tracks the horizontal
 * translation of the strip as the user swipes.
 *
 * During the gesture (onUpdate): translation follows the finger.
 * On gesture end:
 *   - swipe left  past threshold → animate to next tab
 *   - swipe right past threshold → animate to previous tab
 *   - otherwise spring back to current tab
 *
 * Tab screens are rendered via the tab route components directly
 * (not through expo-router Slot), so all three pages stay mounted
 * and their scroll positions / state are preserved while swiping.
 */

import { useCallback } from "react";
import { Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

import { ReviewScreen } from "@/screens/review";
import { StatsScreen } from "@/screens/stats";
import { SettingsScreen } from "@/screens/settings";

// -- Config ---------------------------------------------------------------

const TAB_ROUTES = ["/review", "/stats", "/settings"];
const SWIPE_THRESHOLD = 80;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SCREENS = [
  { route: "/review", Component: ReviewScreen },
  { route: "/stats", Component: StatsScreen },
  { route: "/settings", Component: SettingsScreen },
];

// -- Component ------------------------------------------------------------

export function SwipeTabView({
  activeRoute,
  onTabChange,
}: {
  activeRoute: string;
  onTabChange: (route: string) => void;
}) {
  const activeIndex = TAB_ROUTES.indexOf(activeRoute);
  const translateX = useSharedValue(-activeIndex * SCREEN_WIDTH);

  // Snap translateX to match the active tab (called via runOnJS on
  // gesture end, and also when TabBar click changes the route).
  const snapToIndex = useCallback(
    (index: number) => {
      translateX.value = withTiming(-index * SCREEN_WIDTH, { duration: 250 });
    },
    [translateX],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      // Follow finger: start from current tab position, offset by drag
      translateX.value = -activeIndex * SCREEN_WIDTH + event.translationX;
    })
    .onEnd((event) => {
      const dx = event.translationX;
      if (dx < -SWIPE_THRESHOLD && activeIndex < TAB_ROUTES.length - 1) {
        // Swiped left → next tab
        snapToIndex(activeIndex + 1);
        runOnJS(onTabChange)(TAB_ROUTES[activeIndex + 1]);
      } else if (dx > SWIPE_THRESHOLD && activeIndex > 0) {
        // Swiped right → previous tab
        snapToIndex(activeIndex - 1);
        runOnJS(onTabChange)(TAB_ROUTES[activeIndex - 1]);
      } else {
        // Snap back
        snapToIndex(activeIndex);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1, flexDirection: "row", width: SCREEN_WIDTH * SCREENS.length }, animatedStyle]}>
        {SCREENS.map(({ route, Component }) => (
          <Animated.View key={route} style={{ width: SCREEN_WIDTH, flex: 1 }}>
            <Component />
          </Animated.View>
        ))}
      </Animated.View>
    </GestureDetector>
  );
}
