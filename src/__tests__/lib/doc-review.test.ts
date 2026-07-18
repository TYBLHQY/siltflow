import { describe, it, expect } from "vitest";
import { retrievability } from "@/lib/doc-review";

describe("retrievability", () => {
  it("should return 0 for zero stability", () => {
    expect(retrievability(0, 1)).toBe(0);
  });

  it("should return 0 for negative elapsed days", () => {
    expect(retrievability(10, -1)).toBe(0);
  });

  it("should return 1 (100%) at time zero (just reviewed)", () => {
    const r = retrievability(30, 0);
    expect(r).toBeCloseTo(1, 5);
  });

  it("should decay as elapsed days increases", () => {
    const r0 = retrievability(30, 0);
    const r5 = retrievability(30, 5);
    const r10 = retrievability(30, 10);
    expect(r0).toBeGreaterThan(r5);
    expect(r5).toBeGreaterThan(r10);
  });

  it("should be higher for higher stability at same elapsed days", () => {
    const r_low = retrievability(10, 5);
    const r_high = retrievability(30, 5);
    expect(r_high).toBeGreaterThan(r_low);
  });
});
