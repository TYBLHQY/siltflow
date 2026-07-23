import { useEffect, useState, useRef } from "react";
import { debounce } from "@/lib/utils";

const CONFIG_KEY = "panelLayout";

export function usePanelLayout() {
  const [layout, setLayout] = useState<number[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Restore on mount
  useEffect(() => {
    let cancelled = false;
    window.siltflow.vaultConfigGet().then((cfg) => {
      if (cancelled) return;
      const saved = (cfg as Record<string, unknown>)[CONFIG_KEY];
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
      window.siltflow.vaultConfigSet({ [CONFIG_KEY]: sizes });
    }, 300),
  );

  const saveLayout = (sizes: number[]) => {
    setLayout(sizes);
    saveLayoutRef.current(sizes);
  };

  return { layout, loaded, saveLayout };
}
