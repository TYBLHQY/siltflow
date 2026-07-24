/**
 * Theme hook — auto light/dark based on prefers-color-scheme.
 *
 * Mirrors the desktop app's theme.store.ts pattern:
 *   - Sets a Catppuccin flavor class on <html> (.latte or .mocha)
 *   - Toggles .dark class for Tailwind's dark: variant support
 *   - Listens for OS color-scheme changes
 *
 * index.html runs an inline script to set the initial theme class
 * before first paint, so this hook only needs to react to OS changes
 * after mount — no flash on load.
 */

import { useEffect, useCallback } from "react";

function applyTheme(prefersDark: boolean) {
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
}

export function useAutoTheme() {
  const listener = useCallback(() => {
    applyTheme(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    // Sync on mount in case the inline script's guess was wrong
    // (e.g. user changed OS preference between page loads but the
    //  old HTML was cached).
    applyTheme(mq.matches);

    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [listener]);
}
