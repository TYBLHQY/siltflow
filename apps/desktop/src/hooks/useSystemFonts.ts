import { useState, useEffect } from "react";

/**
 * Queries the user's locally installed fonts via the Font Access API.
 * Falls back to a minimal system font list when the API is unavailable or denied.
 */
export function useSystemFonts(): string[] {
  const [fonts, setFonts] = useState<string[]>([]);

  useEffect(() => {
    if (!("queryLocalFonts" in self)) {
      // Fallback: return a minimal list for browsers without the Font Access API
      setFonts([
        "system-ui, sans-serif",
        "Inter, system-ui, sans-serif",
        "Georgia, 'Times New Roman', serif",
        "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        "'Fira Code', monospace",
      ]);
      return;
    }
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any)
      .queryLocalFonts()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((items: any[]) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const list: string[] = [];
        for (const item of items) {
          const name = item.family as string;
          if (!seen.has(name)) {
            seen.add(name);
            list.push(name);
          }
        }
        list.sort((a, b) => a.localeCompare(b));
        setFonts(list);
      })
      .catch(() => {
        // API not allowed or unavailable
        if (!cancelled)
          setFonts([
            "Inter, system-ui, sans-serif",
            "Georgia, serif",
            "monospace",
          ]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return fonts;
}
