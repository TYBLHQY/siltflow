import { useEffect, useRef, type RefObject } from "react";

/** Accumulated wheel delta (px) needed before switching one tab */
const SWITCH_THRESHOLD = 50;

interface UseTabWheelSwitchOptions {
  /** Container to attach the wheel listener to (the tab bar) */
  containerRef: RefObject<HTMLElement | null>;
  /** Ordered tab values, left → right */
  tabs: readonly string[];
  /** Currently active tab value (falls back to the first tab) */
  activeTab?: string;
  /** Called with the next tab value to activate */
  onChange?: (tab: string) => void;
}

/**
 * Wheel over a tab bar cycles through the tabs: scroll down → next (right),
 * scroll up → previous (left), wrapping around at both ends.
 *
 * Uses a native `passive: false` listener because React's delegated `onWheel`
 * is passive at the root — `preventDefault()` there is ignored, so the page
 * would keep scrolling while tabs switch. Wheel deltas are accumulated against
 * a threshold so one wheel tick = one tab switch, while momentum scrolling can
 * still fly through several tabs.
 */
export function useTabWheelSwitch({
  containerRef,
  tabs,
  activeTab,
  onChange,
}: UseTabWheelSwitchOptions) {
  // Refs instead of deps: re-attaching the listener on every tab switch would
  // drop the momentum events that follow the first switch of a fast flick.
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || tabs.length < 2) return;

    let acc = 0;

    const onWheel = (e: WheelEvent) => {
      // Vertical wheel only; horizontal trackpad scroll passes through.
      if (e.deltaY === 0) return;

      acc += e.deltaY;
      if (Math.abs(acc) < SWITCH_THRESHOLD) return;

      e.preventDefault();
      const cur = activeTabRef.current ?? tabs[0];
      const base = Math.max(0, tabs.indexOf(cur));
      const dir = acc > 0 ? 1 : -1;
      const next = tabs[(base + dir + tabs.length) % tabs.length];
      acc = 0;
      onChangeRef.current?.(next);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [containerRef, tabs]);
}
