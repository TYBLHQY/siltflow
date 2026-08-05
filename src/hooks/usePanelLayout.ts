import { useEffect, useState, useRef } from "react";
import { debounce } from "@/lib/utils";

const CONFIG_KEY = "panelLayout";

export function usePanelLayout() {
  const [layout, setLayout] = useState<number[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Restore on mount
  useEffect(() => {
    let cancelled = false;
    void window.siltflow.vaultConfigGet().then((cfg) => {
      if (cancelled) return;
      const saved = cfg[CONFIG_KEY];
      if (Array.isArray(saved) && saved.length === 3) {
        setLayout(saved as number[]);
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveLayoutRef = useRef(
    debounce((sizes: number[]) => {
      void window.siltflow.vaultConfigSet({ [CONFIG_KEY]: sizes });
    }, 300),
  );

  // Persist layout changes to the vault (debounced). Note: no setLayout here —
  // `layout` state is only used on mount to compute Allotment's defaultSizes
  // (which only applies at mount), so updating it during a drag would just
  // re-render the whole layout tree every pointermove for no visible effect.
  const saveLayout = (sizes: number[]) => {
    saveLayoutRef.current(sizes);
  };

  return { layout, loaded, saveLayout };
}
