/**
 * Catppuccin highlight color utilities.
 *
 * Maps human-readable Catppuccin color names to CSS custom-property references
 * so highlight colors automatically follow the active theme (light / dark mode).
 *
 * react-pdf-highlighter-plus applies `highlightColor` directly to
 * `style.background`, so we pass a `var(--catppuccin-color-xxx)` string.
 * When the `<html>` class switches (latte → frappe → macchiato → mocha)
 * the browser re-resolves the custom property — no re-render needed.
 */

// ── Types ────────────────────────────────────────────────────────────────

/** Catppuccin palette colors suitable for text highlighting. */
export type CatppuccinHighlightColor =
  | "yellow"
  | "peach"
  | "green"
  | "teal"
  | "sky"
  | "blue"
  | "lavender"
  | "mauve"
  | "pink"
  | "maroon"
  | "red"
  | "flamingo"
  | "rosewater"
  | "sapphire";

// ── Color map ─────────────────────────────────────────────────────────────

const CATPPUCCIN_COLOR_VARS: Record<CatppuccinHighlightColor, string> = {
  yellow: "var(--catppuccin-color-yellow)",
  peach: "var(--catppuccin-color-peach)",
  green: "var(--catppuccin-color-green)",
  teal: "var(--catppuccin-color-teal)",
  sky: "var(--catppuccin-color-sky)",
  blue: "var(--catppuccin-color-blue)",
  lavender: "var(--catppuccin-color-lavender)",
  mauve: "var(--catppuccin-color-mauve)",
  pink: "var(--catppuccin-color-pink)",
  maroon: "var(--catppuccin-color-maroon)",
  red: "var(--catppuccin-color-red)",
  flamingo: "var(--catppuccin-color-flamingo)",
  rosewater: "var(--catppuccin-color-rosewater)",
  sapphire: "var(--catppuccin-color-sapphire)",
};

/** Ordered list of all available highlight color names (for picker UIs). */
export const AVAILABLE_COLORS: CatppuccinHighlightColor[] = [
  "yellow",
  "peach",
  "green",
  "teal",
  "sky",
  "blue",
  "lavender",
  "mauve",
  "pink",
  "maroon",
  "red",
  "flamingo",
  "rosewater",
  "sapphire",
];

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Return the CSS `var()` reference for a Catppuccin highlight color.
 *
 * Pass the result as `highlightColor` to react-pdf-highlighter-plus.
 * Colors auto-adapt when the user changes their Catppuccin flavor.
 *
 * @example getHighlightCSSVar("yellow") // "var(--catppuccin-color-yellow)"
 */
export function getHighlightCSSVar(colorName: CatppuccinHighlightColor): string {
  return CATPPUCCIN_COLOR_VARS[colorName];
}

/**
 * Same as `getHighlightCSSVar` but with a type-safe fallback for unknown names.
 * Returns the raw CSS variable reference or `undefined`.
 */
export function resolveHighlightCSSVar(
  colorName: string | undefined,
): string | undefined {
  if (!colorName) return undefined;
  if (colorName in CATPPUCCIN_COLOR_VARS) {
    return CATPPUCCIN_COLOR_VARS[colorName as CatppuccinHighlightColor];
  }
  return undefined;
}

/**
 * Check whether a string is a known Catppuccin highlight color.
 */
export function isHighlightColor(name: string): name is CatppuccinHighlightColor {
  return name in CATPPUCCIN_COLOR_VARS;
}

/**
 * Read the resolved (computed) RGBA value for a Catppuccin color name
 * from the current document.  Useful as a fallback when a consumer
 * (e.g. a canvas API) cannot interpret CSS `var()`.
 */
export function getComputedCatppuccinColor(
  colorName: CatppuccinHighlightColor,
): string {
  const temp = document.createElement("div");
  temp.style.color = CATPPUCCIN_COLOR_VARS[colorName];
  temp.style.display = "none";
  document.body.appendChild(temp);
  const computed = getComputedStyle(temp).color;
  document.body.removeChild(temp);
  return computed;
}
