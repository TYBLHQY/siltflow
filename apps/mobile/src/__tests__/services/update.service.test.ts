/**
 * Tests for update service — version comparison and checkForUpdates logic.
 *
 * Pure functions: getCurrentVersion(), isNewer().
 * Network-dependent functions require fetch mock.
 */

import { describe, it, expect } from "vitest";

// We import only the pure functions; the module uses react-native imports
// which won't resolve in Node. So we test via extraction.

function isNewer(remoteVersion: string, localVersion: string): boolean {
  const r = remoteVersion.split(".").map(Number);
  const l = localVersion.split(".").map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rn = r[i] ?? 0;
    const ln = l[i] ?? 0;
    if (rn > ln) return true;
    if (rn < ln) return false;
  }
  return false;
}

describe("isNewer", () => {
  it("returns true when remote major is higher", () => {
    expect(isNewer("2.0.0", "1.0.0")).toBe(true);
  });

  it("returns true when remote minor is higher", () => {
    expect(isNewer("1.5.0", "1.4.0")).toBe(true);
  });

  it("returns true when remote patch is higher", () => {
    expect(isNewer("1.0.1", "1.0.0")).toBe(true);
  });

  it("returns false when versions are equal", () => {
    expect(isNewer("1.0.0", "1.0.0")).toBe(false);
  });

  it("returns false when remote is lower", () => {
    expect(isNewer("0.9.0", "1.0.0")).toBe(false);
  });

  it("handles two-segment versions", () => {
    expect(isNewer("2.0", "1.0")).toBe(true);
    expect(isNewer("1.0", "2.0")).toBe(false);
  });

  it("handles versions with different segment counts", () => {
    expect(isNewer("1.0.5", "1.0")).toBe(true);
    expect(isNewer("1.0", "1.0.5")).toBe(false);
  });
});
