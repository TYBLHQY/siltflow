import { describe, it, expect, beforeEach } from "vitest";
import { useAnnotationStore, type AnnotationItem } from "@/stores/annotation.store";
import type { AIAnnotationDataV2 } from "@/types/annotation";

// Mock the Electron preload bridge so the store's persistence side-effects
// (annotations.save / aiResults.save / fsrsCards.save) resolve without IPC.
const savedVersions: Array<number | undefined> = [];
const mockSiltflow = {
  annotations: {
    list: () => Promise.resolve([]),
    listAll: () => Promise.resolve([]),
    save: () => Promise.resolve({ id: "" }),
    delete: () => Promise.resolve(),
  },
  aiResults: {
    get: () => Promise.resolve(null),
    listByDocument: () => Promise.resolve([]),
    save: (
      _annotationId: string,
      _documentId: string,
      _data: unknown,
      version?: number,
    ) => {
      savedVersions.push(version);
      return Promise.resolve({ annotationId: _annotationId });
    },
    delete: () => Promise.resolve(),
  },
  fsrsCards: {
    get: () => Promise.resolve(null),
    save: () => Promise.resolve(null),
    delete: () => Promise.resolve(),
  },
};
(globalThis as Record<string, unknown>).window = {
  siltflow: mockSiltflow,
};

const v2Result: AIAnnotationDataV2 = {
  input: {
    text: "grok",
    normalized: "grok",
    source_lang: "en-US",
    type: "word",
  },
  context: null,
  output: {
    translation: "领会",
    meanings: [],
    definitions: [],
    examples: [],
    collocations: [],
    synonyms: [],
    cefr: "B2",
  },
};

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

describe("annotation.store version handling", () => {
  beforeEach(() => {
    useAnnotationStore.setState({ items: [] });
    savedVersions.length = 0;
  });

  it("keeps aiVersion === 2 when an edit patch omits aiVersion", () => {
    useAnnotationStore.setState({
      items: [
        makeItem({ aiResult: v2Result, aiVersion: 2 }),
      ],
    });

    // handleSaveText for a V2 card syncs input.normalized but passes no aiVersion.
    useAnnotationStore
      .getState()
      .updateItem("a1", {
        text: "GROK",
        aiResult: {
          ...v2Result,
          input: { ...v2Result.input, normalized: "GROK" },
        },
      });

    const updated = useAnnotationStore.getState().items[0];
    expect(updated.aiVersion).toBe(2);
  });

  it("persists the V2 version to aiResults when an edit patch omits aiVersion", () => {
    useAnnotationStore.setState({
      items: [
        makeItem({ aiResult: v2Result, aiVersion: 2 }),
      ],
    });

    useAnnotationStore
      .getState()
      .updateItem("a1", {
        text: "GROK",
        aiResult: {
          ...v2Result,
          input: { ...v2Result.input, normalized: "GROK" },
        },
      });

    expect(savedVersions).toContain(2);
  });

  it("keeps aiVersion undefined for a newly created (untranslated) item", () => {
    useAnnotationStore.getState().addItem(makeItem());

    const created = useAnnotationStore.getState().items[0];
    expect(created.aiVersion).toBeUndefined();
  });

  it("upgrades a V1 card to V2 (aiVersion: 1 → 2) and persists version 2", () => {
    // Legacy V1 card — the payload is opaque now that the V1 schema is removed.
    useAnnotationStore.setState({
      items: [
        makeItem({
          aiResult: {} as AIAnnotationDataV2,
          aiVersion: 1,
        }),
      ],
    });

    useAnnotationStore.getState().updateItem("a1", {
      aiResult: v2Result,
      aiVersion: 2,
    });

    const updated = useAnnotationStore.getState().items[0];
    expect(updated.aiVersion).toBe(2);
    expect(savedVersions).toContain(2);
  });

  it("leaves aiVersion === 1 untouched when a V1 card's text is edited", () => {
    useAnnotationStore.setState({
      items: [
        makeItem({
          aiResult: {} as AIAnnotationDataV2,
          aiVersion: 1,
        }),
      ],
    });

    // A bare text patch (no aiResult) must not touch the version, and must not
    // trigger an aiResults.save — V1 cards are read-only.
    useAnnotationStore.getState().updateItem("a1", { text: "GROK" });

    const updated = useAnnotationStore.getState().items[0];
    expect(updated.aiVersion).toBe(1);
    expect(updated.text).toBe("GROK");
    expect(savedVersions).toHaveLength(0);
  });
});
