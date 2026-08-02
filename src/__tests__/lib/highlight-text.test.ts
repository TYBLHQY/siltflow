import { describe, it, expect } from "vitest";
import { highlightText } from "@/lib/search-utils";

interface Segment {
  text: string;
  highlighted: boolean;
}

describe("highlightText", () => {
  it("returns a single unhighlighted segment when indices are undefined", () => {
    expect(highlightText("hello world", undefined)).toEqual([
      { text: "hello world", highlighted: false },
    ]);
  });

  it("returns a single unhighlighted segment for an empty indices array", () => {
    expect(highlightText("hello", [])).toEqual([
      { text: "hello", highlighted: false },
    ]);
  });

  it("splits a mid-string range into before / match / after", () => {
    expect(highlightText("the grok word", [[4, 7]])).toEqual([
      { text: "the ", highlighted: false },
      { text: "grok", highlighted: true },
      { text: " word", highlighted: false },
    ]);
  });

  it("handles a range starting at index 0 (no leading segment)", () => {
    expect(highlightText("grokking", [[0, 3]])).toEqual([
      { text: "grok", highlighted: true },
      { text: "king", highlighted: false },
    ]);
  });

  it("handles a range ending at the last character (no trailing segment)", () => {
    expect(highlightText("pizza", [[0, 4]])).toEqual([
      { text: "pizza", highlighted: true },
    ]);
  });

  it("emits no gap text between adjacent non-overlapping ranges", () => {
    expect(highlightText("a b c", [[0, 2], [4, 4]])).toEqual([
      { text: "a b", highlighted: true },
      { text: " ", highlighted: false },
      { text: "c", highlighted: true },
    ]);
  });

  it("keeps the running end monotonic across multiple ranges", () => {
    // The second range starts exactly where the first ended (end is inclusive,
    // so lastEnd = end + 1) — no gap slice is emitted and no negative slice.
    expect(highlightText("ab", [[0, 0], [1, 1]])).toEqual([
      { text: "a", highlighted: true },
      { text: "b", highlighted: true },
    ]);
  });

  it("uses an inclusive end boundary (end === length - 1 keeps the last char)", () => {
    expect(highlightText("abc", [[1, 2]])).toEqual([
      { text: "a", highlighted: false },
      { text: "bc", highlighted: true },
    ]);
  });

  it("preserves the original text exactly when segments are re-joined", () => {
    const text = "Grokking the Grok";
    const indices: ReadonlyArray<readonly [number, number]> = [
      [0, 3],
      [13, 16],
    ];
    const joined = highlightText(text, indices).map((s) => s.text).join("");
    expect(joined).toBe(text);
  });

  it("appends a second overlapping range without a negative gap slice", () => {
    // The function's contract is monotonic lastEnd, not overlap de-duping:
    // a range starting before lastEnd emits no gap segment but still appends
    // its own highlighted slice (characters can render twice). Fuse.js does
    // not normally produce overlapping ranges — this documents the behavior.
    expect(highlightText("abcd", [[0, 2], [1, 3]])).toEqual([
      { text: "abc", highlighted: true },
      { text: "bcd", highlighted: true },
    ]);
  });
});

describe("highlightText segment shape (helper for rendering)", () => {
  it("yields the expected highlighted:false / true pattern for a two-match text", () => {
    const segments: Segment[] = highlightText("Grokking the Grok", [
      [0, 3],
      [13, 16],
    ]);
    expect(segments.map((s) => s.highlighted)).toEqual([
      true,
      false,
      true,
    ]);
    expect(segments.map((s) => s.text)).toEqual(["Grok", "king the ", "Grok"]);
  });
});
