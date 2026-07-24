/**
 * SwipeTabView — wraps each tab's Slot content in a horizontal pan-gesture
 * detector. Swiping left or right navigates to the adjacent tab.
 *
 * We use a single GestureDetector inside the tab layout that tracks
 * accumulated horizontal translation via Reanimated shared values.
 * On gesture end: if the total swipe exceeded the threshold, we
 * jump to the neighbour tab; otherwise we spring back.
 */

import { ReactNode, useCallback } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { View } from "@/tw";

// -- Tab order (same as TabBar.TABS) ------------------------------------

const TAB_ROUTES = ["/review", "/stats", "/settings"];

// -- Threshold -----------------------------------------------------------

const SWIPE_THRESHOLD = 80; // px — must swipe this far to trigger a tab change

// -- Component -----------------------------------------------------------

export function SwipeTabView({
  children,
  activeRoute,
  onTabChange,
}: {
  children: ReactNode;
  activeRoute: string;
  onTabChange: (route: string) => void;
}) {
  const navigateToAdjacent = useCallback(
    (direction: "left" | "right") => {
      const idx = TAB_ROUTES.indexOf(activeRoute);
      if (idx === -1) return;
      const next = direction === "right" ? idx + 1 : idx - 1;
      if (next < 0 || next >= TAB_ROUTES.length) return;
      onTabChange(TAB_ROUTES[next]);
    },
    [activeRoute, onTabChange],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20]) // only activate on horizontal drags
    .failOffsetY([-10, 10])
    .onEnd((event) => {
      if (event.translationX < -SWIPE_THRESHOLD) {
        // Swiped left → next tab
        navigateToAdjacent("right");
      } else if (event.translationX > SWIPE_THRESHOLD) {
        // Swiped right → previous tab
        navigateToAdjacent("left");
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View className="flex-1">
        {children}
      </View>
    </GestureDetector>
  );
}
