/**
 * Tests for pure FSRS utility functions.
 */

import { describe, it, expect } from "vitest";
import {
  toDate,
  cardDueDate,
  formatDue,
  formatDate,
  formatStability,
  formatInterval,
  createNewCardStub,
  retrievability,
  retrievabilityLabel,
  parseReviewLogData,
  STATE_LABEL,
  STATE_BG,
  STATE_TEXT_COLOR,
  GRADE_LABEL,
  GRADE_COLOR,
  GRADE_TEXT_COLOR,
} from "@/lib/fsrs-utils";
import { State } from "ts-fsrs";

// ── toDate ─────────────────────────────────────────────────────────────────

describe("toDate", () => {
  it("returns Date instances unchanged", () => {
    const d = new Date("2025-01-15T12:00:00Z");
    expect(toDate(d)).toBe(d);
  });

  it("converts ISO strings to Date", () => {
    const result = toDate("2025-01-15T12:00:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe("2025-01-15T12:00:00.000Z");
  });

  it("returns invalid Date for bogus input", () => {
    const result = toDate("not-a-date");
    expect(isNaN(result.getTime())).toBe(true);
  });
});

// ── cardDueDate ────────────────────────────────────────────────────────────

describe("cardDueDate", () => {
  it("extracts due from a ts-fsrs Card", () => {
    const card = { due: new Date("2026-08-01T00:00:00Z") } as any;
    const d = cardDueDate(card);
    expect(d).toBeInstanceOf(Date);
    expect(d.getUTCFullYear()).toBe(2026);
  });

  it("converts ISO string due to Date", () => {
    const card = { due: "2026-08-01T00:00:00Z" } as any;
    const d = cardDueDate(card);
    expect(d).toBeInstanceOf(Date);
  });
});

// ── formatDue ──────────────────────────────────────────────────────────────

describe("formatDue", () => {
  it('returns "due today" for today', () => {
    const today = new Date();
    expect(formatDue(today)).toBe("due today");
  });

  it('returns "due tomorrow" for tomorrow', () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    expect(formatDue(tomorrow)).toBe("due tomorrow");
  });

  it("returns N days overdue for past dates", () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000);
    expect(formatDue(fiveDaysAgo)).toMatch(/^\d+d overdue$/);
  });

  it('returns "due in Nd" for future dates', () => {
    const in3Days = new Date(Date.now() + 3 * 86_400_000);
    expect(formatDue(in3Days)).toBe("due in 3d");
  });

  it('returns "unknown" for invalid dates', () => {
    expect(formatDue("invalid")).toBe("unknown");
  });
});

// ── formatDate ─────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("returns null for undefined input", () => {
    expect(formatDate(undefined)).toBeNull();
  });

  it("returns null for invalid dates", () => {
    expect(formatDate("bad")).toBeNull();
  });

  it("returns a formatted string for a valid date", () => {
    const result = formatDate(new Date("2025-06-15T14:30:00Z"));
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });
});

// ── formatStability ────────────────────────────────────────────────────────

describe("formatStability", () => {
  it("formats sub-day stability as minutes", () => {
    expect(formatStability(0.5)).toBe("720m");
  });

  it("formats <30 day stability with 1 decimal", () => {
    expect(formatStability(12.34)).toBe("12.3d");
  });

  it("formats <365 day stability as integer days", () => {
    expect(formatStability(100)).toBe("100d");
  });

  it("formats >365 day stability as years", () => {
    expect(formatStability(400)).toBe("1.1y");
  });
});

// ── formatInterval ─────────────────────────────────────────────────────────

describe("formatInterval", () => {
  it("formats sub-day interval as minutes", () => {
    expect(formatInterval(0.5)).toBe("720m");
  });

  it("formats <30 day interval as integer days", () => {
    expect(formatInterval(15)).toBe("15d");
  });

  it("formats <365 day interval as months", () => {
    expect(formatInterval(100)).toBe("3.3mo");
  });

  it("formats >365 day interval as years", () => {
    expect(formatInterval(400)).toBe("1.1y");
  });
});

// ── createNewCardStub ──────────────────────────────────────────────────────

describe("createNewCardStub", () => {
  it("returns a Card with state New", () => {
    const card = createNewCardStub();
    expect(card).toBeDefined();
    expect(card.state).toBe(State.New);
    expect(card.due).toBeDefined();
  });
});

// ── retrievability ─────────────────────────────────────────────────────────

describe("retrievability", () => {
  it("returns 0 for zero stability", () => {
    expect(retrievability(0, 5)).toBe(0);
  });

  it("returns 0 for negative elapsed days", () => {
    expect(retrievability(10, -1)).toBe(0);
  });

  it("returns 1 at time zero", () => {
    expect(retrievability(30, 0)).toBeCloseTo(1, 5);
  });

  it("decays as elapsed days increase", () => {
    const r0 = retrievability(30, 0);
    const r10 = retrievability(30, 10);
    expect(r10).toBeLessThan(r0);
  });

  it("is higher for higher stability", () => {
    expect(retrievability(100, 5)).toBeGreaterThan(retrievability(10, 5));
  });
});

// ── retrievabilityLabel ────────────────────────────────────────────────────

describe("retrievabilityLabel", () => {
  it('returns "fresh" for >= 90%', () => {
    expect(retrievabilityLabel(95)).toBe("fresh");
    expect(retrievabilityLabel(90)).toBe("fresh");
  });

  it('returns "ok" for >= 75%', () => {
    expect(retrievabilityLabel(80)).toBe("ok");
    expect(retrievabilityLabel(75)).toBe("ok");
  });

  it('returns "due" for >= 50%', () => {
    expect(retrievabilityLabel(60)).toBe("due");
    expect(retrievabilityLabel(50)).toBe("due");
  });

  it('returns "overdue" for < 50%', () => {
    expect(retrievabilityLabel(30)).toBe("overdue");
    expect(retrievabilityLabel(0)).toBe("overdue");
  });
});

// ── parseReviewLogData ─────────────────────────────────────────────────────

describe("parseReviewLogData", () => {
  it("parses valid JSON", () => {
    const raw = JSON.stringify({ grade: 3, log: {}, card: { state: 2 } });
    const parsed = parseReviewLogData(raw);
    expect(parsed).toBeDefined();
    expect(parsed!.grade).toBe(3);
  });

  it("returns null for invalid JSON", () => {
    expect(parseReviewLogData("not json")).toBeNull();
    expect(parseReviewLogData("")).toBeNull();
  });
});

// ── State constants ────────────────────────────────────────────────────────

describe("FSRS constants", () => {
  it("STATE_LABEL covers all 4 states", () => {
    expect(STATE_LABEL[0]).toBe("New");
    expect(STATE_LABEL[1]).toBe("Learning");
    expect(STATE_LABEL[2]).toBe("Review");
    expect(STATE_LABEL[3]).toBe("Relearning");
  });

  it("STATE_BG has entries for all states", () => {
    expect(STATE_BG[0]).toContain("bg-");
    expect(STATE_BG[1]).toContain("bg-");
    expect(STATE_BG[2]).toContain("bg-");
    expect(STATE_BG[3]).toContain("bg-");
  });

  it("STATE_TEXT_COLOR has entries for all states", () => {
    expect(STATE_TEXT_COLOR[0]).toContain("text-");
  });

  it("GRADE_LABEL covers all 4 grades", () => {
    expect(GRADE_LABEL[1]).toBe("Again");
    expect(GRADE_LABEL[2]).toBe("Hard");
    expect(GRADE_LABEL[3]).toBe("Good");
    expect(GRADE_LABEL[4]).toBe("Easy");
  });

  it("GRADE_COLOR has CSS var references for all grades", () => {
    expect(GRADE_COLOR[1]).toContain("var(--");
    expect(GRADE_COLOR[2]).toContain("var(--");
    expect(GRADE_COLOR[3]).toContain("var(--");
    expect(GRADE_COLOR[4]).toContain("var(--");
  });

  it("GRADE_TEXT_COLOR has Tailwind classes for all grades", () => {
    expect(GRADE_TEXT_COLOR[1]).toContain("text-");
    expect(GRADE_TEXT_COLOR[2]).toContain("text-");
    expect(GRADE_TEXT_COLOR[3]).toContain("text-");
    expect(GRADE_TEXT_COLOR[4]).toContain("text-");
  });
});
