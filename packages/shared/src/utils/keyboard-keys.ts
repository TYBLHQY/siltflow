export interface ParsedKey {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

function normalizeKey(key: string): string {
  switch (key) {
    case "space":
      return " ";
    case "num1": case "num2": case "num3": case "num4": case "num5":
    case "num6": case "num7": case "num8": case "num9": case "num0":
      return key.slice(3);
    case "comma":
      return ",";
    default:
      return key;
  }
}

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
      case "alt": result.altKey = true; break;
      case "ctrl": result.ctrlKey = true; break;
      case "shift": result.shiftKey = true; break;
      case "meta": result.metaKey = true; break;
      default: key = normalizeKey(part);
    }
  }

  if (!key) return null;
  result.key = key;
  return result;
}

export function matchShortcut(
  parsed: ParsedKey,
  event: { key: string; altKey: boolean; ctrlKey: boolean; shiftKey: boolean; metaKey: boolean; code?: string },
): boolean {
  if (parsed.altKey !== event.altKey) return false;
  if (parsed.ctrlKey !== event.ctrlKey) return false;
  if (parsed.shiftKey !== event.shiftKey) return false;
  if (parsed.metaKey !== event.metaKey) return false;

  const eventKey = event.key.toLowerCase();

  if (parsed.key === eventKey) return true;

  if (/^[0-9]$/.test(parsed.key)) {
    return eventKey === parsed.key || event.code === `Numpad${parsed.key}`;
  }

  return false;
}

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
