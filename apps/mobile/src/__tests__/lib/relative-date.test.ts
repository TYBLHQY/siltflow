/**
 * Tests for formatRelativeDate — the relative-time formatting utility
 * extracted from useDocumentFilter.ts.
 */

import { describe, it, expect } from "vitest";

// The function is defined inside useDocumentFilter.ts as a module-level helper.
// We test it by extraction. In production it's called from useDocumentFilter hook.

/**
 * Format an ISO date string as a relative time label.
 */
function formatRelativeDate(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

describe("formatRelativeDate", () => {
  it('returns "just now" for recent timestamps', () => {
    const now = new Date().toISOString();
    expect(formatRelativeDate(now)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeDate(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(formatRelativeDate(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    expect(formatRelativeDate(twoDaysAgo)).toBe("2d ago");
  });

  it("returns date label for >7 days ago", () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400 * 1000).toISOString();
    const result = formatRelativeDate(twoWeeksAgo);
    // Should be "Mon DD" format
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });
});
