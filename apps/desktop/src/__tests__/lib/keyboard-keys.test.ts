/**
 * Tests for keyboard shortcut parsing, matching, and formatting.
 */

import { describe, it, expect } from "vitest";
import { parseShortcut, matchShortcut, formatShortcut } from "@/lib/keyboard-keys";

// ── parseShortcut ──────────────────────────────────────────────────────────

describe("parseShortcut", () => {
  it("parses a plain key (no modifiers)", () => {
    const parsed = parseShortcut("Space");
    expect(parsed).toBeDefined();
    expect(parsed!.key).toBe(" ");
    expect(parsed!.altKey).toBe(false);
    expect(parsed!.ctrlKey).toBe(false);
  });

  it("parses Alt+key combination", () => {
    const parsed = parseShortcut("alt+1");
    expect(parsed!.key).toBe("1");
    expect(parsed!.altKey).toBe(true);
    expect(parsed!.ctrlKey).toBe(false);
  });

  it("parses Ctrl+key combination", () => {
    const parsed = parseShortcut("ctrl+e");
    expect(parsed!.key).toBe("e");
    expect(parsed!.ctrlKey).toBe(true);
  });

  it("parses Shift+key combination", () => {
    const parsed = parseShortcut("shift+a");
    expect(parsed!.key).toBe("a");
    expect(parsed!.shiftKey).toBe(true);
  });

  it("parses Meta+key combination", () => {
    const parsed = parseShortcut("meta+s");
    expect(parsed!.key).toBe("s");
    expect(parsed!.metaKey).toBe(true);
  });

  it("normalizes numpad keys", () => {
    expect(parseShortcut("num1")!.key).toBe("1");
    expect(parseShortcut("num5")!.key).toBe("5");
    expect(parseShortcut("num0")!.key).toBe("0");
  });

  it("normalizes comma key", () => {
    expect(parseShortcut("comma")!.key).toBe(",");
  });

  it("returns null if no key is found (only modifiers)", () => {
    expect(parseShortcut("ctrl+alt")).toBeNull();
  });

  it("is case-insensitive for modifier names", () => {
    expect(parseShortcut("CTRL+E")!.key).toBe("e");
    expect(parseShortcut("Alt+F")!.altKey).toBe(true);
  });

  it("handles multiple modifiers", () => {
    const parsed = parseShortcut("ctrl+alt+shift+t");
    expect(parsed!.key).toBe("t");
    expect(parsed!.ctrlKey).toBe(true);
    expect(parsed!.altKey).toBe(true);
    expect(parsed!.shiftKey).toBe(true);
  });
});

// ── matchShortcut ──────────────────────────────────────────────────────────

describe("matchShortcut", () => {
  function makeEvent(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
    // Minimal mock — only the fields matchShortcut reads
    return {
      key,
      code: "",
      altKey: false,
      ctrlKey: false,
      shiftKey: false,
      metaKey: false,
      ...modifiers,
    } as KeyboardEvent;
  }

  it("matches a plain key", () => {
    const parsed = parseShortcut("Space")!;
    expect(matchShortcut(parsed, makeEvent(" "))).toBe(true);
  });

  it("matches Alt+1", () => {
    const parsed = parseShortcut("alt+1")!;
    expect(matchShortcut(parsed, makeEvent("1", { altKey: true }))).toBe(true);
  });

  it("rejects if modifier is missing", () => {
    const parsed = parseShortcut("ctrl+e")!;
    expect(matchShortcut(parsed, makeEvent("e"))).toBe(false);
  });

  it("rejects if key is different", () => {
    const parsed = parseShortcut("alt+1")!;
    expect(matchShortcut(parsed, makeEvent("2", { altKey: true }))).toBe(false);
  });

  it("matches numpad keys via code fallback", () => {
    const parsed = parseShortcut("num1")!;
    // Normal keyboard "1" key
    expect(matchShortcut(parsed, makeEvent("1"))).toBe(true);
    // Numpad 1 key — key is still "1", code provides Numpad hint
    expect(matchShortcut(parsed, {
      key: "1",
      code: "Numpad1",
      altKey: false, ctrlKey: false, shiftKey: false, metaKey: false,
    } as any)).toBe(true);
  });

  it("matches Ctrl+Enter", () => {
    const parsed = parseShortcut("ctrl+enter")!;
    expect(matchShortcut(parsed, makeEvent("Enter", { ctrlKey: true }))).toBe(true);
  });
});

// ── formatShortcut ─────────────────────────────────────────────────────────

describe("formatShortcut", () => {
  it('capitalizes "Space"', () => {
    expect(formatShortcut("space")).toBe("Space");
  });

  it('formats "ctrl+alt+d" as "Ctrl+Alt+D"', () => {
    expect(formatShortcut("ctrl+alt+d")).toBe("Ctrl+Alt+D");
  });

  it('replaces "meta" with "⌘"', () => {
    expect(formatShortcut("meta+s")).toBe("⌘+S");
  });

  it('strips "num" prefix from numpad keys', () => {
    expect(formatShortcut("num5")).toBe("5");
  });

  it('handles comma', () => {
    expect(formatShortcut("comma")).toBe(",");
  });
});
