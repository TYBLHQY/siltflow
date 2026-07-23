/**
 * Theme hook — auto light/dark based on prefers-color-scheme.
 *
 * Mirrors the desktop app's theme.store.ts pattern:
 *   - Sets a Catppuccin flavor class on <html> (.latte or .mocha)
 *   - Toggles .dark class for Tailwind's dark: variant support
 *   - Listens for OS color-scheme changes
 *
 * The mocha.css import provides both light (latte via :root fallback)
 * and dark (mocha via .mocha class) colour variables.
 */

import { useEffect, useCallback } from "react";

export function useAutoTheme() {
  const apply = useCallback(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const html = document.documentElement;

    if (prefersDark) {
      html.classList.add("mocha");
      html.classList.remove("latte");
      html.classList.add("dark");
    } else {
      html.classList.add("latte");
      html.classList.remove("mocha");
      html.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    apply();

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => apply();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [apply]);
}
