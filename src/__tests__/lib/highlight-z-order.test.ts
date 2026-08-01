import { describe, it, expect } from "vitest";
import type { AnnotationItem } from "@/stores/annotation.store";
import { highlightArea, sortItemsForZOrder } from "@/lib/highlight-z-order";

/** Minimal AnnotationItem with a position built from corner points. */
function makeItem(
  id: string,
  opts: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    createdAt?: string;
  },
): AnnotationItem {
  const { x1, y1, x2, y2, createdAt } = opts;
  return {
    id,
    documentId: "doc-1",
    type: "text",
    kind: "annotation",
    text: id,
    pageNumber: 1,
    embedData: {
      position: {
        boundingRect: {
          x1,
          y1,
          x2,
          y2,
          width: 612,
          height: 792,
          pageNumber: 1,
        },
        rects: [{ x1, y1, x2, y2, width: 612, height: 792, pageNumber: 1 }],
        usePdfCoordinates: false,
      },
    },
    ...(createdAt ? { createdAt } : {}),
  };
}

describe("highlightArea", () => {
  it("computes area from corner points, not page-size width/height", () => {
    const word = makeItem("w", { x1: 50, y1: 100, x2: 140, y2: 120 });
    const sent = makeItem("s", { x1: 50, y1: 100, x2: 400, y2: 140 });
    // width/height (612*792) are identical for both — the corners must differ.
    expect(highlightArea(word)).toBe((140 - 50) * (120 - 100)); // 1800
    expect(highlightArea(sent)).toBe((400 - 50) * (140 - 100)); // 14000
    expect(highlightArea(word)).toBeLessThan(highlightArea(sent));
  });

  it("uses the largest rect across pages for multi-page highlights", () => {
    const multi = {
      ...makeItem("m", { x1: 0, y1: 0, x2: 10, y2: 10 }),
      embedData: {
        position: {
          boundingRect: {
            x1: 0,
            y1: 0,
            x2: 10,
            y2: 10,
            width: 612,
            height: 792,
            pageNumber: 1,
          },
          rects: [
            {
              x1: 0,
              y1: 0,
              x2: 5,
              y2: 5,
              width: 612,
              height: 792,
              pageNumber: 1,
            },
            {
              x1: 0,
              y1: 0,
              x2: 20,
              y2: 20,
              width: 612,
              height: 792,
              pageNumber: 2,
            },
          ],
          usePdfCoordinates: false,
        },
      },
    };
    expect(highlightArea(multi)).toBe(20 * 20);
  });

  it("returns 0 when position is missing", () => {
    const bare: AnnotationItem = {
      id: "b",
      documentId: "doc-1",
      type: "text",
      kind: "annotation",
      text: "b",
      pageNumber: 1,
      embedData: { position: undefined as never },
    };
    expect(highlightArea(bare)).toBe(0);
  });
});

describe("sortItemsForZOrder", () => {
  it("sorts descending by area so smaller (contained) items end up last/topmost", () => {
    const sent = makeItem("sent", { x1: 50, y1: 100, x2: 400, y2: 140 });
    const word = makeItem("word", { x1: 50, y1: 100, x2: 140, y2: 120 });
    const sorted = sortItemsForZOrder([sent, word]);
    // Word (smaller) must be at the array tail = topmost DOM layer.
    expect(sorted.map((i) => i.id)).toEqual(["sent", "word"]);
  });

  it("tie-breaks equal areas by createdAt, then id (deterministic)", () => {
    const a = makeItem("a", {
      x1: 0,
      y1: 0,
      x2: 10,
      y2: 10,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const b = makeItem("b", {
      x1: 0,
      y1: 0,
      x2: 10,
      y2: 10,
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    expect(sortItemsForZOrder([b, a]).map((i) => i.id)).toEqual(["a", "b"]);

    // No createdAt → falls back to id order, still deterministic.
    const c = makeItem("c", { x1: 0, y1: 0, x2: 10, y2: 10 });
    const d = makeItem("d", { x1: 0, y1: 0, x2: 10, y2: 10 });
    expect(sortItemsForZOrder([d, c]).map((i) => i.id)).toEqual(["c", "d"]);
  });

  it("does not mutate the input array", () => {
    const sent = makeItem("sent", { x1: 50, y1: 100, x2: 400, y2: 140 });
    const word = makeItem("word", { x1: 50, y1: 100, x2: 140, y2: 120 });
    const input = [sent, word];
    sortItemsForZOrder(input);
    expect(input.map((i) => i.id)).toEqual(["sent", "word"]);
  });

  it("keeps non-overlapping highlights in a stable deterministic order", () => {
    const top = makeItem("top", { x1: 0, y1: 0, x2: 100, y2: 20 });
    const bottom = makeItem("bottom", { x1: 0, y1: 200, x2: 100, y2: 220 });
    expect(sortItemsForZOrder([top, bottom]).map((i) => i.id)).toEqual([
      "bottom",
      "top",
    ]);
  });
});
