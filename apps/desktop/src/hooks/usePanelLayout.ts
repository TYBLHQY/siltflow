import { useEffect, useState } from "react";

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

  const saveLayout = (sizes: number[]) => {
    setLayout(sizes);
    window.siltflow.vaultConfigSet({ [CONFIG_KEY]: sizes });
  };

  return { layout, loaded, saveLayout };
}
