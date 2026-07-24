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
 * IMPORTANT: Pan gesture callbacks run on the UI (worklet) thread.
 * We use Reanimated shared values inside them so the values are
 * always current — JS-thread closures would read stale state.
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

  // ── Animate to target index (worklet-safe) ─────────────────────────
  //   Called from gesture callbacks (UI thread) or from useEffect
  //   (JS thread). Both are fine — useSharedValue is thread-safe.

  const springTo = useCallback(
    (index: number, instant = false) => {
      const target = -index * SCREEN_WIDTH;
      cancelAnimation(translateX);
      translateX.value = instant ? target : withSpring(target, SPRING);
    },
    [translateX],
  );

  // ── TabBar tap → spring ────────────────────────────────────────────

  useEffect(() => {
    springTo(activeIndex);
  }, [activeIndex, springTo]);

  // ── Pan gesture (UI-thread safe via shared values) ─────────────────
  //
  //   We store the "base" translateX at gesture start in a shared value
  //   so the UI thread can read it directly during onUpdate/onEnd without
  //   accessing stale JS closures. The activeIndex is copied to a shared
  //   value for the same reason.

  const baseX = useSharedValue(0);  // translateX when the finger touched down
  const activeIdxSV = useSharedValue(activeIndex);

  // Keep the shared-value copy in sync from the JS thread
  useEffect(() => {
    activeIdxSV.value = activeIndex;
  }, [activeIndex]);

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .onStart(() => {
      cancelAnimation(translateX);
      baseX.value = translateX.value;
    })
    .onUpdate((event) => {
      translateX.value = baseX.value + event.translationX;
    })
    .onEnd((event) => {
      const idx = activeIdxSV.value;
      const dx = event.translationX;
      if (dx < -SWIPE_THRESHOLD && idx < ROUTES.length - 1) {
        springTo(idx + 1);
        runOnJS(onTabChange)(ROUTES[idx + 1]);
      } else if (dx > SWIPE_THRESHOLD && idx > 0) {
        springTo(idx - 1);
        runOnJS(onTabChange)(ROUTES[idx - 1]);
      } else {
        springTo(idx);
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
