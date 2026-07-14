/**
 * Hook for registering keyboard shortcuts in components.
 *
 * Usage:
 *   useShortcut("toggleLeftPanel", handler)
 *   useShortcut("gradeAgain", handler, { enabled: studyPanelOpen })
 *
 * The hook reads the current key mapping from the shortcuts store,
 * so user customizations apply automatically.
 */

import { useEffect, useRef } from "react";
import { useShortcutsStore } from "@/stores/shortcuts.store";
import { parseShortcut, matchShortcut } from "@siltflow/shared/utils";
import type { ShortcutActionId } from "@/stores/shortcuts.store";

interface UseShortcutOptions {
  /** When false, the handler won't fire (default: true) */
  enabled?: boolean;
}

export function useShortcut(
  actionId: ShortcutActionId,
  handler: () => void,
  options?: UseShortcutOptions,
) {
  const enabled = options?.enabled ?? true;
  // Subscribe to the exact key string so the effect re-runs when the shortcut changes
  const keys = useShortcutsStore((s) => s.getKeys(actionId));
  const handlerRef = useRef(handler);

  // Keep the handler ref current (avoids stale closure issues)
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    const parsed = parseShortcut(keys);
    if (!parsed) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in input/textarea/select/contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        // But allow global ctrl+ shortcuts that aren't for text input
        // (like ctrl+e for fit-width) even in inputs
        if (!e.ctrlKey && !e.metaKey) return;
      }

      if (matchShortcut(parsed, e)) {
        e.preventDefault();
        e.stopPropagation();
        handlerRef.current();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [actionId, enabled, keys]);
}
