import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fuse, { type IFuseOptions } from "fuse.js";
import { useSearchStore, type SearchEntry } from "@/stores/search.store";
import { useAnnotationStore } from "@/stores/annotation.store";
import { useDocumentStore } from "@/stores/document.store";
import type { AnnotationEnrichedIPC, DocumentIPCItem } from "@/types/ipc";

// ── Mock the Electron preload bridge ────────────────────────────────────
// buildIndex calls window.siltflow.documents.list + annotations.listAll.
// vi.fn lets each test set return values and assert call counts.
const documentsList = vi.fn<() => Promise<DocumentIPCItem[]>>();
const annotationsListAll = vi.fn<() => Promise<AnnotationEnrichedIPC[]>>();
(globalThis as Record<string, unknown>).window = {
  siltflow: {
    documents: { list: documentsList },
    annotations: { listAll: annotationsListAll },
  },
};

// ── Fuse options ────────────────────────────────────────────────────────
// FUSE_OPTIONS is not exported from search.store; replicate the stable
// production literal so seeded indexes behave identically.
const FUSE_OPTIONS_TEST: IFuseOptions<SearchEntry> = {
  keys: [{ name: "searchText", weight: 1 }],
  threshold: 0.4,
  distance: 100,
  location: 0,
  ignoreLocation: true,
  includeMatches: true,
  findAllMatches: true,
  minMatchCharLength: 2,
  isCaseSensitive: false,
  ignoreDiacritics: true,
  ignoreFieldNorm: true,
};

// ── Fixtures ────────────────────────────────────────────────────────────

function makeEntry(id: string, text: string): SearchEntry {
  return {
    id,
    annotation: {
      id,
      documentId: "d1",
      type: "text",
      kind: "annotation",
      text,
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
      },
    },
    documentId: "d1",
    documentTitle: "Doc 1",
    searchText: text,
  };
}

function makeDocRow(id: string, title: string): DocumentIPCItem {
  return {
    id,
    title,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

function makeAnnRow(
  overrides: Partial<Record<string, unknown>> = {},
): AnnotationEnrichedIPC {
  // embed_data / ai_data / fsrs_data arrive pre-parsed as objects: the IPC
  // layer's mapEnriched runs tryParseJson on the SQLite string columns before
  // they cross the bridge (see electron/ipc/annotations.ipc.ts).
  return {
    id: "a1",
    document_id: "d1",
    type: "text",
    text: "grok the grok",
    page_number: 1,
    embed_data: {
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
        rects: [],
      },
    } as unknown as AnnotationEnrichedIPC["embed_data"],
    kind: "annotation",
    context: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ai_data: null,
    ai_version: null,
    fsrs_data: null,
    ...overrides,
  };
}

/** Seed the search index directly with a real Fuse instance. */
function seedIndex(entries: SearchEntry[]) {
  useSearchStore.setState({
    entries,
    fuseInstance: new Fuse(entries, FUSE_OPTIONS_TEST),
  });
}

// ── Reset ───────────────────────────────────────────────────────────────

function resetSearchStore() {
  useSearchStore.setState({
    isOpen: false,
    indexBuilt: false,
    isBuilding: false,
    entries: [],
    fuseInstance: null,
    query: "",
    results: [],
    selectedIndex: 0,
    selectedEntry: null,
  });
}

beforeEach(() => {
  documentsList.mockReset();
  annotationsListAll.mockReset();
  resetSearchStore();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

// ── search() ────────────────────────────────────────────────────────────

describe("search", () => {
  it("returns [] for empty and whitespace queries", () => {
    const st = useSearchStore.getState();
    expect(st.search("")).toEqual([]);
    expect(st.search("   ")).toEqual([]);
  });

  it("trims the query before matching", () => {
    seedIndex([makeEntry("1", "Grokking the Grok")]);
    const results = useSearchStore.getState().search("  grok  ");
    expect(results.map((r) => r.item.id)).toEqual(["1"]);
  });

  it("matches case-insensitively", () => {
    seedIndex([makeEntry("1", "Grokking the Grok")]);
    const lower = useSearchStore.getState().search("grok");
    const upper = useSearchStore.getState().search("GROK");
    expect(lower.map((r) => r.item.id)).toEqual(["1"]);
    expect(upper.map((r) => r.item.id)).toEqual(["1"]);
  });

  it("returns match indices so the UI can render <mark> segments", () => {
    seedIndex([makeEntry("1", "Grokking the Grok")]);
    const results = useSearchStore.getState().search("grok");
    const match = results[0].matches?.find((m) => m.key === "searchText");
    expect(match?.indices).toEqual([
      [0, 3],
      [13, 16],
    ]);
  });

  it("ignores single-character queries (minMatchCharLength 2)", () => {
    seedIndex([makeEntry("2", "pizza")]);
    expect(useSearchStore.getState().search("x")).toEqual([]);
  });

  it("matches ignoring diacritics", () => {
    seedIndex([makeEntry("3", "séance")]);
    const results = useSearchStore.getState().search("seance");
    expect(results.map((r) => r.item.id)).toEqual(["3"]);
  });

  it("matches substrings under the fuzzy threshold", () => {
    seedIndex([makeEntry("2", "pizza")]);
    const results = useSearchStore.getState().search("piz");
    expect(results.map((r) => r.item.id)).toEqual(["2"]);
  });

  it("reuses the cached fuseInstance instead of rebuilding", () => {
    seedIndex([makeEntry("1", "Grokking the Grok")]);
    const spy = vi.spyOn(Fuse.prototype, "search");
    useSearchStore.getState().search("grok");
    useSearchStore.getState().search("grok");
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it("falls back to a one-shot Fuse when fuseInstance is null", () => {
    useSearchStore.setState({
      entries: [makeEntry("1", "Grokking the Grok")],
      fuseInstance: null,
    });
    const results = useSearchStore.getState().search("grok");
    expect(results.map((r) => r.item.id)).toEqual(["1"]);
  });
});

// ── setQuery ────────────────────────────────────────────────────────────

describe("setQuery", () => {
  it("updates the query, resets selection, and fills results", () => {
    seedIndex([makeEntry("1", "Grokking the Grok")]);
    useSearchStore.setState({ selectedIndex: 2 });

    useSearchStore.getState().setQuery("grok");

    const st = useSearchStore.getState();
    expect(st.query).toBe("grok");
    expect(st.selectedIndex).toBe(0);
    expect(st.results.map((r) => r.item.id)).toEqual(["1"]);
  });
});

// ── open / close / toggle ──────────────────────────────────────────────

describe("open / close / toggle", () => {
  it("close resets query, results, selection, and the detail entry", () => {
    useSearchStore.setState({
      isOpen: true,
      query: "grok",
      results: [{ item: makeEntry("1", "x"), refIndex: 0 }],
      selectedIndex: 1,
      selectedEntry: makeEntry("1", "x"),
    });

    useSearchStore.getState().close();

    const st = useSearchStore.getState();
    expect(st.isOpen).toBe(false);
    expect(st.query).toBe("");
    expect(st.results).toEqual([]);
    expect(st.selectedIndex).toBe(0);
    expect(st.selectedEntry).toBeNull();
  });

  it("open flips isOpen true", () => {
    useSearchStore.setState({ isOpen: false });
    useSearchStore.getState().open();
    expect(useSearchStore.getState().isOpen).toBe(true);
  });

  it("toggle flips between open and closed", () => {
    useSearchStore.setState({ isOpen: false });
    useSearchStore.getState().toggle();
    expect(useSearchStore.getState().isOpen).toBe(true);
    useSearchStore.getState().toggle();
    expect(useSearchStore.getState().isOpen).toBe(false);
  });
});

// ── buildIndex ──────────────────────────────────────────────────────────

describe("buildIndex", () => {
  it("calls both IPC endpoints in parallel and builds entries", async () => {
    documentsList.mockResolvedValue([makeDocRow("d1", "Doc 1")]);
    annotationsListAll.mockResolvedValue([makeAnnRow()]);

    await useSearchStore.getState().buildIndex();

    expect(documentsList).toHaveBeenCalledTimes(1);
    expect(annotationsListAll).toHaveBeenCalledTimes(1);
    const st = useSearchStore.getState();
    expect(st.indexBuilt).toBe(true);
    expect(st.fuseInstance).not.toBeNull();
    expect(st.entries).toHaveLength(1);
    expect(st.entries[0].documentTitle).toBe("Doc 1");
    expect(st.entries[0].searchText).toBe("grok the grok");
  });

  it("falls back to (unknown) when a document title is missing", async () => {
    documentsList.mockResolvedValue([makeDocRow("d1", "Doc 1")]);
    annotationsListAll.mockResolvedValue([
      makeAnnRow({ id: "a1", document_id: "missing" }),
    ]);

    await useSearchStore.getState().buildIndex();

    expect(useSearchStore.getState().entries[0].documentTitle).toBe(
      "(unknown)",
    );
  });

  it("zeroes embedData and keeps pageNumber when position is absent", async () => {
    documentsList.mockResolvedValue([]);
    annotationsListAll.mockResolvedValue([
      makeAnnRow({ id: "a1", page_number: 7, embed_data: "{}" }),
    ]);

    await useSearchStore.getState().buildIndex();

    const ann = useSearchStore.getState().entries[0].annotation;
    expect(ann.embedData.position.boundingRect.width).toBe(0);
    expect(ann.embedData.position.boundingRect.pageNumber).toBe(7);
  });

  it("parses ai_data / fsrs_data JSON strings (valid and malformed)", async () => {
    documentsList.mockResolvedValue([]);
    annotationsListAll.mockResolvedValue([
      makeAnnRow({ id: "a1", ai_data: '{"output":{"translation":"x"}}' }),
      makeAnnRow({ id: "a2", ai_data: "not json" }),
      makeAnnRow({ id: "a3", fsrs_data: '{"stability":5}' }),
    ]);

    await useSearchStore.getState().buildIndex();

    const byId = new Map(
      useSearchStore.getState().entries.map((e) => [e.id, e.annotation]),
    );
    expect(byId.get("a1")?.aiResult).toEqual({ output: { translation: "x" } });
    expect(byId.get("a2")?.aiResult).toBeUndefined();
    expect(byId.get("a3")?.fsrsCard).toEqual({ stability: 5 });
  });

  it("defaults a falsy kind to annotation", async () => {
    documentsList.mockResolvedValue([]);
    annotationsListAll.mockResolvedValue([makeAnnRow({ id: "a1", kind: "" })]);

    await useSearchStore.getState().buildIndex();

    expect(useSearchStore.getState().entries[0].annotation.kind).toBe(
      "annotation",
    );
  });

  it("resets isBuilding without throwing when IPC fails", async () => {
    documentsList.mockResolvedValue([]);
    annotationsListAll.mockRejectedValue(new Error("db down"));

    await expect(
      useSearchStore.getState().buildIndex(),
    ).resolves.toBeUndefined();

    const st = useSearchStore.getState();
    expect(st.isBuilding).toBe(false);
    expect(st.indexBuilt).toBe(false);
  });

  it("is idempotent — a second call returns early without re-fetching", async () => {
    documentsList.mockResolvedValue([makeDocRow("d1", "Doc 1")]);
    annotationsListAll.mockResolvedValue([makeAnnRow()]);

    await useSearchStore.getState().buildIndex();
    await useSearchStore.getState().buildIndex();

    expect(documentsList).toHaveBeenCalledTimes(1);
    expect(annotationsListAll).toHaveBeenCalledTimes(1);
  });
});

// ── Invalidation side effect ────────────────────────────────────────────

describe("index invalidation", () => {
  it("debounces a search-index reset after annotation store changes", () => {
    vi.useFakeTimers();
    useSearchStore.setState({
      indexBuilt: true,
      fuseInstance: new Fuse([], FUSE_OPTIONS_TEST),
    });

    // Any annotation-store change schedules the 1s debounce.
    useAnnotationStore.setState({ items: [] });

    // Before 1s elapses the index is still valid.
    expect(useSearchStore.getState().indexBuilt).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(useSearchStore.getState().indexBuilt).toBe(false);
    expect(useSearchStore.getState().fuseInstance).toBeNull();
  });

  it("debounces a search-index reset after document store changes", () => {
    vi.useFakeTimers();
    useSearchStore.setState({
      indexBuilt: true,
      fuseInstance: new Fuse([], FUSE_OPTIONS_TEST),
    });

    useDocumentStore.setState({ documents: [] });

    vi.advanceTimersByTime(1000);
    expect(useSearchStore.getState().indexBuilt).toBe(false);
  });
});
