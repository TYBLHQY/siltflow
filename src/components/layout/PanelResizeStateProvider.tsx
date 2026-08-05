import { useEffect, useState, type ReactNode } from "react";
import { PanelResizeStateContext } from "@/hooks/usePanelResizeState";

const SASH_SELECTOR = "[data-testid='sash']";

/**
 * Provides a `resizing` flag to descendants (used by the PDF fit-width freeze).
 *
 * The flag turns true while an Allotment sash is being dragged. The sash is
 * `[data-testid="sash"]` and drags use Pointer Events, so we detect drag start
 * via a document-level pointerdown delegated to the sash, and end via a window
 * pointerup. Delegation stays robust to the sash mounting after this provider
 * mounts (it is rendered before the three-column layout exists).
 *
 * See the context docs in @/hooks/usePanelResizeState for the fallback if
 * Allotment ever stops emitting native pointer events.
 */
export function PanelResizeStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest?.(SASH_SELECTOR)) return;
      setResizing(true);
    };
    const onPointerUp = () => setResizing(false);

    // Delegated: fires even if the sash mounts after this effect runs.
    document.addEventListener("pointerdown", onPointerDown);
    // Window-level so a drag released outside the window still resets.
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  return (
    <PanelResizeStateContext.Provider value={resizing}>
      {children}
    </PanelResizeStateContext.Provider>
  );
}
