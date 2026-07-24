/**
 * SwipeTabView — horizontally paginated tab container with spring
 * sliding animation.
 *
 * Renders all three tab screens side-by-side in a single row at
 * screen width. A Reanimated shared value tracks the horizontal
 * translation as the user swipes.
 *
 * Gesture callbacks use the "worklet" directive and shared values —
 * everything runs on the UI thread. runOnJS bridges to JS to call
 * the onTabChange callback (expo-router navigation must happen on JS).
 *
 * TabBar taps → useEffect → withSpring on the shared value.
 */

import { useEffect } from "react";
import { Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  cancelAnimation,
  runOnJS,
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

const SPRING = { damping: 20, stiffness: 200, mass: 0.8, overshootClamping: false };

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
  const activeIdxSV = useSharedValue(activeIndex);

  useEffect(() => {
    activeIdxSV.value = activeIndex;
  }, [activeIndex]);

  // -- TabBar tap → spring (JS thread, shared value is thread-safe) ------

  useEffect(() => {
    cancelAnimation(translateX);
    translateX.value = withSpring(-activeIndex * SCREEN_WIDTH, SPRING);
  }, [activeIndex, translateX]);

  // -- Pan gesture (UI thread) -------------------------------------------

  let baseX = 0;

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .onStart(() => {
      "worklet";
      cancelAnimation(translateX);
      baseX = translateX.value;
    })
    .onUpdate((event) => {
      "worklet";
      translateX.value = baseX + event.translationX;
    })
    .onEnd((event) => {
      "worklet";
      const idx = activeIdxSV.value;
      const dx = event.translationX;
      let targetIdx = idx;
      if (dx < -SWIPE_THRESHOLD && idx < ROUTES.length - 1) targetIdx = idx + 1;
      else if (dx > SWIPE_THRESHOLD && idx > 0) targetIdx = idx - 1;

      if (targetIdx !== idx) {
        runOnJS(onTabChange)(ROUTES[targetIdx]);
      }
      cancelAnimation(translateX);
      translateX.value = withSpring(-targetIdx * SCREEN_WIDTH, SPRING);
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
