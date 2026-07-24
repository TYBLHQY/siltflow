/**
 * SwipeTabView — horizontally paginated tab container with spring
 * sliding animation.
 *
 * Renders all three tab screens side-by-side in a single row at
 * screen width. A Reanimated shared value tracks the horizontal
 * translation of the strip as the user swipes.
 *
 * During the gesture (onUpdate): translation follows the finger.
 * On gesture end:
 *   - swipe left  past threshold → spring to next tab
 *   - swipe right past threshold → spring to previous tab
 *   - otherwise spring back to current tab
 *
 * TabBar taps also trigger the spring via useEffect on activeRoute
 * change (outside of gesture land).
 *
 * Tab screens are rendered via the tab route components directly
 * (not through expo-router Slot), so all three pages stay mounted
 * and their scroll positions / state are preserved while swiping.
 */

import { useCallback, useEffect } from "react";
import { Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  cancelAnimation,
} from "react-native-reanimated";

import { ReviewScreen } from "@/screens/review";
import { StatsScreen } from "@/screens/stats";
import { SettingsScreen } from "@/screens/settings";

// -- Config ---------------------------------------------------------------

const ROUTES: string[] = ["/review", "/stats", "/settings"];
const SWIPE_THRESHOLD = 80;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PAGES = [
  { route: "/review", Component: ReviewScreen },
  { route: "/stats", Component: StatsScreen },
  { route: "/settings", Component: SettingsScreen },
];

// -- Spring config --------------------------------------------------------

const SPRING = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
  overshootClamping: false,
};

// -- Component ------------------------------------------------------------

export function SwipeTabView({
  activeRoute,
  onTabChange,
}: {
  activeRoute: string;
  onTabChange: (route: string) => void;
}) {
  const activeIndex = ROUTES.indexOf(activeRoute);
  const translateX = useSharedValue(-activeIndex * SCREEN_WIDTH);

  // Animate to target index with spring physics.
  const springTo = useCallback(
    (index: number, instant = false) => {
      const target = -index * SCREEN_WIDTH;
      cancelAnimation(translateX);
      translateX.value = instant
        ? target
        : withSpring(target, SPRING);
    },
    [translateX],
  );

  // ── TabBar tap → spring ────────────────────────────────────────────
  // When the user taps a TabBar button, router.replace fires and
  // activeRoute changes. This effect picks that up and springs the
  // pager to the new index (no gesture involved, so we skip the
  // "during gesture" case).

  useEffect(() => {
    // round to nearest screen — if we're mid-gesture, let the gesture
    // own the animation instead
    const currentPage = Math.abs(Math.round(translateX.value / SCREEN_WIDTH));
    if (currentPage !== activeIndex) {
      springTo(activeIndex);
    }
  }, [activeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pan gesture ────────────────────────────────────────────────────

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .onStart(() => {
      cancelAnimation(translateX);
    })
    .onUpdate((event) => {
      translateX.value = -activeIndex * SCREEN_WIDTH + event.translationX;
    })
    .onEnd((event) => {
      const dx = event.translationX;
      if (dx < -SWIPE_THRESHOLD && activeIndex < ROUTES.length - 1) {
        springTo(activeIndex + 1);
        runOnJS(onTabChange)(ROUTES[activeIndex + 1]);
      } else if (dx > SWIPE_THRESHOLD && activeIndex > 0) {
        springTo(activeIndex - 1);
        runOnJS(onTabChange)(ROUTES[activeIndex - 1]);
      } else {
        springTo(activeIndex);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          { flex: 1, flexDirection: "row", width: SCREEN_WIDTH * PAGES.length },
          animatedStyle,
        ]}
      >
        {PAGES.map(({ route, Component }) => (
          <Animated.View key={route} style={{ width: SCREEN_WIDTH, flex: 1 }}>
            <Component />
          </Animated.View>
        ))}
      </Animated.View>
    </GestureDetector>
  );
}
