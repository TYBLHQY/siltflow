/**
 * Tests for annotation helper functions.
 */

import { describe, it, expect } from "vitest";
import {
  getTranslation,
  getDefinitions,
  getCollocations,
  getIpa,
  getDifficulty,
  getRegister,
  getAlternatives,
  inferGranularity,
  hasDetails,
} from "@/lib/annotation-helpers";
import type { AIAnnotationDataV1 } from "@/types/annotation";

// Minimal mock matching the AIAnnotationDataV1 shape
function makeAiData(overrides: Partial<AIAnnotationDataV1> = {}): AIAnnotationDataV1 {
  return {
    translation: "hello",
    source_lang: "en",
    target_lang: "zh",
    cleaned_input: "hello",
    lemma: "hello",
    pos: "interj",
    ...overrides,
  } as AIAnnotationDataV1;
}

describe("getTranslation", () => {
  it("returns translation field", () => {
    expect(getTranslation(makeAiData({ translation: "你好" }))).toBe("你好");
  });

  it("returns undefined if missing", () => {
    expect(getTranslation(makeAiData({ translation: undefined as any }))).toBeUndefined();
  });
});

describe("getDefinitions", () => {
  it("returns definitions array", () => {
    const defs = [
      { pos: "n", definition: "greeting", gloss: "问候" },
    ];
    expect(getDefinitions(makeAiData({ definitions: defs }))).toEqual(defs);
  });

  it("filters out empty definitions", () => {
    const defs = [
      { pos: "n", definition: "", gloss: "" },
      { pos: "v", definition: "to greet", gloss: "打招呼" },
    ] as any;
    const result = getDefinitions(makeAiData({ definitions: defs }));
    expect(result).toHaveLength(1);
    expect(result[0].gloss).toBe("打招呼");
  });

  it("returns empty array if definitions is undefined", () => {
    expect(getDefinitions(makeAiData({ definitions: undefined }))).toEqual([]);
  });
});

describe("getCollocations", () => {
  it("returns collocations array", () => {
    const colls = [{ phrase: "say hello", translation: "说你好" }];
    expect(getCollocations(makeAiData({ collocations: colls }))).toEqual(colls);
  });

  it("returns empty array if undefined", () => {
    expect(getCollocations(makeAiData({ collocations: undefined }))).toEqual([]);
  });
});

describe("getIpa", () => {
  it("returns IPA from pronunciation", () => {
    expect(getIpa(makeAiData({ pronunciation: { ipa: "həˈloʊ" } }))).toBe("həˈloʊ");
  });

  it("returns undefined if no pronunciation", () => {
    expect(getIpa(makeAiData({ pronunciation: undefined }))).toBeUndefined();
  });
});

describe("getDifficulty", () => {
  it("returns difficulty from metadata", () => {
    expect(getDifficulty(makeAiData({ metadata: { difficulty: "A1" } as any }))).toBe("A1");
  });

  it("returns undefined if no metadata", () => {
    expect(getDifficulty(makeAiData({ metadata: undefined }))).toBeUndefined();
  });
});

describe("getRegister", () => {
  it("returns register from metadata", () => {
    expect(getRegister(makeAiData({ metadata: { register: "formal" } as any }))).toBe("formal");
  });
});

describe("getAlternatives", () => {
  it("returns alternatives array", () => {
    const alts = [{ expression: "hi", register: "casual" }] as any;
    expect(getAlternatives(makeAiData({ alternatives: alts }))).toEqual(alts);
  });

  it("returns empty array if undefined", () => {
    expect(getAlternatives(makeAiData({ alternatives: undefined }))).toEqual([]);
  });
});

describe("inferGranularity", () => {
  it('returns "word" for single word', () => {
    expect(inferGranularity({} as any, "hello")).toBe("word");
  });

  it('returns "phrase" for short phrase', () => {
    expect(inferGranularity({} as any, "hello world today")).toBe("phrase");
  });

  it('returns "sentence" for multi-line text', () => {
    expect(inferGranularity({} as any, "hello world\nthis is a test")).toBe("sentence");
  });

  it('returns "sentence" for >30 words', () => {
    const long = Array.from({ length: 35 }, (_, i) => `word${i}`).join(" ");
    expect(inferGranularity({} as any, long)).toBe("sentence");
  });
});

describe("hasDetails", () => {
  it("returns false for minimal data", () => {
    expect(hasDetails(makeAiData())).toBe(false);
  });

  it("returns true when collocations are present", () => {
    expect(hasDetails(makeAiData({
      collocations: [{ phrase: "test", translation: "测试" }],
    }))).toBe(true);
  });

  it("returns true when examples are present", () => {
    expect(hasDetails(makeAiData({
      examples: [{ sentence: "Hello world", translation: "你好世界" }],
    }))).toBe(true);
  });

  it("returns true when multiple definitions are present", () => {
    expect(hasDetails(makeAiData({
      definitions: [
        { pos: "n", definition: "meaning 1", gloss: "" },
        { pos: "v", definition: "meaning 2", gloss: "" },
      ],
    }))).toBe(true);
  });
});
