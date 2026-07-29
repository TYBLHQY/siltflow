/**
 * Tests for Catppuccin highlight color utilities.
 */

import { describe, it, expect } from "vitest";
import {
  getHighlightCSSVar,
  resolveHighlightCSSVar,
  isHighlightColor,
  AVAILABLE_COLORS,
} from "@/lib/colors";

describe("getHighlightCSSVar", () => {
  it("returns a CSS var() for known colors", () => {
    const result = getHighlightCSSVar("yellow");
    expect(result).toBe("var(--catppuccin-color-yellow)");
  });

  it("works for all AVAILABLE_COLORS", () => {
    for (const color of AVAILABLE_COLORS) {
      const result = getHighlightCSSVar(color);
      expect(result).toContain(`--catppuccin-color-${color}`);
      expect(result).toMatch(/^var\(--catppuccin-color-\w+\)$/);
    }
  });
});

describe("resolveHighlightCSSVar", () => {
  it("returns undefined for undefined input", () => {
    expect(resolveHighlightCSSVar(undefined)).toBeUndefined();
  });

  it("returns CSS var for known color", () => {
    expect(resolveHighlightCSSVar("green")).toBe("var(--catppuccin-color-green)");
  });

  it("returns undefined for unknown color", () => {
    expect(resolveHighlightCSSVar("not-a-color")).toBeUndefined();
  });
});

describe("isHighlightColor", () => {
  it("returns true for valid colors", () => {
    expect(isHighlightColor("red")).toBe(true);
    expect(isHighlightColor("mauve")).toBe(true);
  });

  it("returns false for invalid colors", () => {
    expect(isHighlightColor("purple")).toBe(false);
    expect(isHighlightColor("")).toBe(false);
  });
});

describe("AVAILABLE_COLORS", () => {
  it("contains 14 colors", () => {
    expect(AVAILABLE_COLORS).toHaveLength(14);
  });

  it("all entries have a CSS var mapping", () => {
    for (const color of AVAILABLE_COLORS) {
      expect(getHighlightCSSVar(color)).toBeDefined();
    }
  });

  it("contains the most commonly used colors", () => {
    expect(AVAILABLE_COLORS).toContain("yellow");
    expect(AVAILABLE_COLORS).toContain("green");
    expect(AVAILABLE_COLORS).toContain("blue");
    expect(AVAILABLE_COLORS).toContain("red");
    expect(AVAILABLE_COLORS).toContain("pink");
  });
});
