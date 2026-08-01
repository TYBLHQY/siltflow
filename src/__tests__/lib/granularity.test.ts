import { describe, it, expect } from "vitest";
import { inferGranularity } from "@/lib/granularity";

describe("inferGranularity", () => {
  it("classifies single words and 2-word phrases as word", () => {
    expect(inferGranularity("run")).toBe("word");
    expect(inferGranularity("  hello  ")).toBe("word");
    // Original heuristic: only > 2 words counts as a phrase.
    expect(inferGranularity("two words")).toBe("word");
  });

  it("classifies 3+ word phrases as phrase", () => {
    expect(inferGranularity("break a leg")).toBe("phrase");
  });

  it("classifies multi-sentence text as sentence", () => {
    expect(inferGranularity("First sentence. Second sentence.")).toBe(
      "sentence",
    );
  });

  it("classifies long passages as sentence", () => {
    const long = Array.from({ length: 40 }, () => "word").join(" ");
    expect(inferGranularity(long)).toBe("sentence");
  });

  it("classifies newline-separated text as sentence", () => {
    expect(inferGranularity("line one\nline two")).toBe("sentence");
  });
});
