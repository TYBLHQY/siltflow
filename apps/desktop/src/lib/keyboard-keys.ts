/**
 * Keyboard shortcut parsing and matching utilities.
 * Supports key strings like "alt+1", "ctrl+e", "Space", "num3".
 */

export interface ParsedKey {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/** Normalize key names for matching (e.g., "space" → " ", "num1" → "1"). */
function normalizeKey(key: string): string {
  switch (key) {
    case "space":
      return " ";
    case "num1":
      return "1";
    case "num2":
      return "2";
    case "num3":
      return "3";
    case "num4":
      return "4";
    case "num5":
      return "5";
    case "num6":
      return "6";
    case "num7":
      return "7";
    case "num8":
      return "8";
    case "num9":
      return "9";
    case "num0":
      return "0";
    case "comma":
      return ",";
    default:
      return key;
  }
}

/** Parse a shortcut string like "alt+1" or "ctrl+e" or "Space" into a ParsedKey. */
export function parseShortcut(shortcut: string): ParsedKey | null {
  const parts = shortcut.toLowerCase().split("+");
  let key = "";
  const result: ParsedKey = {
    key: "",
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
  };

  for (const part of parts) {
    switch (part) {
      case "alt":
        result.altKey = true;
        break;
      case "ctrl":
        result.ctrlKey = true;
        break;
      case "shift":
        result.shiftKey = true;
        break;
      case "meta":
        result.metaKey = true;
        break;
      default:
        key = normalizeKey(part);
    }
  }

  if (!key) return null;
  result.key = key;
  return result;
}

/** Check if a KeyboardEvent matches a parsed shortcut. */
export function matchShortcut(
  parsed: ParsedKey,
  event: KeyboardEvent,
): boolean {
  if (parsed.altKey !== event.altKey) return false;
  if (parsed.ctrlKey !== event.ctrlKey) return false;
  if (parsed.shiftKey !== event.shiftKey) return false;
  if (parsed.metaKey !== event.metaKey) return false;

  const eventKey = event.key.toLowerCase();

  // Direct match
  if (parsed.key === eventKey) return true;

  // Handle number pad mapping (e.g., "1" should match "1" or "Numpad1")
  if (/^[0-9]$/.test(parsed.key)) {
    return eventKey === parsed.key || event.code === `Numpad${parsed.key}`;
  }

  return false;
}

/** Format a shortcut string for human-readable display: "alt+1" → "Alt+1", "Space" → "Space". */
export function formatShortcut(shortcut: string): string {
  const parts = shortcut.split("+");
  return parts
    .map((p) => {
      const lower = p.toLowerCase();
      if (lower === "space") return "Space";
      if (lower === "ctrl") return "Ctrl";
      if (lower === "alt") return "Alt";
      if (lower === "shift") return "Shift";
      if (lower === "meta") return "⌘";
      if (lower.startsWith("num")) return lower.slice(3);
      if (lower === "comma") return ",";
      return lower.length === 1 ? lower.toUpperCase() : p;
    })
    .join("+");
}
