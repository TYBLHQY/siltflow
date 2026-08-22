import { describe, expect, it } from "vitest";
import { annotationToPlainText } from "@/lib/annotation-list-text";
import type { AnnotationItem } from "@/stores/annotation.store";
import type { AIAnnotationDataV2 } from "@/types/annotation";

function makeItem(overrides: Partial<AnnotationItem> = {}): AnnotationItem {
  return {
    id: "a1",
    documentId: "d1",
    type: "text",
    kind: "annotation",
    text: "grok",
    pageNumber: 1,
    embedData: {
      position: {
        boundingRect: {
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 0,
          width: 0,
          height: 0,
          pageNumber: 1,
        },
        rects: [],
      },
      content: { text: "grok" },
    },
    ...overrides,
  };
}

const wordV2: AIAnnotationDataV2 = {
  input: {
    text: "grok",
    normalized: "grok",
    source_lang: "en-US",
    type: "word",
  },
  documentContext: null,
  output: {
    meanings: [
      { pos: "NOUN", translation: "领会" },
      { pos: "VERB", translation: "理解" },
    ],
    definitions: [],
    examples: [],
    collocations: [],
    synonyms: [],
    cefr: "B2",
  },
};

const phraseV2: AIAnnotationDataV2 = {
  input: {
    text: "take off",
    normalized: "take off",
    source_lang: "en-US",
    type: "phrase",
  },
  documentContext: null,
  output: { translation: "起飞；脱下" },
};

describe("annotationToPlainText", () => {
  it("formats a V2 word: page, kind, source, then semicolon-joined meanings", () => {
    expect(annotationToPlainText(makeItem({ aiResult: wordV2 }))).toBe(
      "p.1  [word]\ngrok\n→ 领会；理解",
    );
  });

  it("formats a phrase/sentence via its single translation", () => {
    expect(
      annotationToPlainText(makeItem({ text: "take off", aiResult: phraseV2 })),
    ).toBe("p.1  [phrase]\ntake off\n→ 起飞；脱下");
  });

  it("falls back to [note] and omits the translation line when untranslated", () => {
    expect(annotationToPlainText(makeItem({ aiResult: null }))).toBe(
      "p.1  [note]\ngrok",
    );
  });

  it("labels manual annotations and uses — for page 0", () => {
    expect(
      annotationToPlainText(
        makeItem({ kind: "manual", pageNumber: 0, text: "my note" }),
      ),
    ).toBe("—  [manual]\nmy note");
  });

  it("appends the user context note", () => {
    expect(
      annotationToPlainText(
        makeItem({ aiResult: wordV2, context: "learned in ch.3" }),
      ),
    ).toBe("p.1  [word]\ngrok\n→ 领会；理解\nnote: learned in ch.3");
  });
});
