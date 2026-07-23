import { create } from "zustand";
import Fuse from "fuse.js";
import type { IFuseOptions, FuseResult } from "fuse.js";
import type { AnnotationItem } from "@/stores/annotation.store";

// ── Search entry (flattened index item for Fuse) ────────────────────

export interface SearchEntry {
  id: string;
  annotation: AnnotationItem;
  documentId: string;
  documentTitle: string;
  /** Annotation text used as the searchable field */
  searchText: string;
}

// ── Fuse configuration ──────────────────────────────────────────────

const FUSE_OPTIONS: IFuseOptions<SearchEntry> = {
  keys: [
    { name: "searchText", weight: 1 },
  ],
  // ── Fuzzy matching ──
  threshold: 0.4,
  distance: 100,
  location: 0,
  ignoreLocation: true,
  // ── Match behavior ──
  includeMatches: true,
  findAllMatches: true,
  minMatchCharLength: 2,
  // ── Case / diacritics ──
  isCaseSensitive: false,
  ignoreDiacritics: true,
  // ── Field normalization ──
  ignoreFieldNorm: true,
};

// ── Store state ─────────────────────────────────────────────────────

interface SearchState {
  // Dialog state
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;

  // Index state
  indexBuilt: boolean;
  isBuilding: boolean;
  entries: SearchEntry[];
  fuseInstance: Fuse<SearchEntry> | null;

  // Search state
  query: string;
  setQuery: (q: string) => void;
  results: FuseResult<SearchEntry>[];
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;

  // Detail view
  selectedEntry: SearchEntry | null;
  selectEntry: (entry: SearchEntry | null) => void;

  // Actions
  buildIndex: () => Promise<void>;
  search: (query: string) => FuseResult<SearchEntry>[];
}

export const useSearchStore = create<SearchState>()((set, get) => ({
  // ── Dialog ──
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, selectedEntry: null, query: "", results: [], selectedIndex: 0 }),
  toggle: () => {
    const { isOpen, close, open } = get();
    if (isOpen) close();
    else open();
  },

  // ── Index ──
  indexBuilt: false,
  isBuilding: false,
  entries: [],
  fuseInstance: null,

  // ── Search ──
  query: "",
  setQuery: (q: string) => {
    const result = get().search(q);
    set({ query: q, selectedIndex: 0, results: result });
  },
  results: [],
  selectedIndex: 0,
  setSelectedIndex: (i: number) => set({ selectedIndex: i }),

  // ── Detail ──
  selectedEntry: null,
  selectEntry: (entry: SearchEntry | null) => set({ selectedEntry: entry }),

  // ── Actions ──
  buildIndex: async () => {
    const { indexBuilt, isBuilding } = get();
    if (indexBuilt || isBuilding) return;

    set({ isBuilding: true });

    try {
      // Fetch documents and ALL annotations in parallel — 2 IPC calls instead
      // of 1+D sequential calls (where D = number of documents).
      const [docs, allAnnotations] = await Promise.all([
        window.siltflow.documents.list(),
        window.siltflow.annotations.listAll(),
      ]);

      const docMap = new Map<string, string>();
      for (const d of docs) {
        docMap.set(d.id, d.title);
      }

      const entries: SearchEntry[] = [];
      for (const ann of allAnnotations) {
        const docTitle = docMap.get(ann.document_id) ?? "(unknown)";

        // IPC handler already calls tryParseJson on embed_data / ai_data /
        // fsrs_data. Use them as objects directly; fall back to JSON.parse
        // only if the IPC serializer sent a string instead.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ed = ann.embed_data as any;
        const embedData: AnnotationItem["embedData"] =
          ed && typeof ed === "object" && ed.position
            ? (ed as AnnotationItem["embedData"])
            : {
                position: {
                  boundingRect: { x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0, pageNumber: ann.page_number ?? 1 },
                  rects: [],
                },
                content: { text: ann.text ?? "" },
              };

        let aiResult: AnnotationItem["aiResult"];
        if (typeof ann.ai_data === "string") {
          try { aiResult = JSON.parse(ann.ai_data); } catch { aiResult = undefined; }
        } else {
          aiResult = (ann.ai_data ?? undefined) as AnnotationItem["aiResult"];
        }

        let fsrsCard: AnnotationItem["fsrsCard"];
        if (typeof ann.fsrs_data === "string") {
          try { fsrsCard = JSON.parse(ann.fsrs_data); } catch { fsrsCard = undefined; }
        } else {
          fsrsCard = (ann.fsrs_data ?? undefined) as AnnotationItem["fsrsCard"];
        }

        const item: AnnotationItem = {
          id: ann.id,
          documentId: ann.document_id,
          type: ann.type,
          kind: (ann.kind as AnnotationItem["kind"]) || "annotation",
          text: ann.text ?? "",
          pageNumber: ann.page_number ?? 1,
          embedData,
          aiResult,
          aiVersion: ann.ai_version ?? undefined,
          fsrsCard,
        };

        entries.push({
          id: ann.id,
          annotation: item,
          documentId: ann.document_id,
          documentTitle: docTitle,
          searchText: item.text,
        });
      }

      // Pre-build Fuse index and cache the instance so every keystroke
      // reuses it instead of constructing a new Fuse (which builds its
      // internal index from scratch — O(entries × keys) each time).
      const fuseIndex = Fuse.createIndex(FUSE_OPTIONS.keys!, entries);
      const fuse = new Fuse(entries, FUSE_OPTIONS, fuseIndex);
      set({ entries, indexBuilt: true, isBuilding: false, fuseInstance: fuse });
    } catch (err) {
      console.error("[search.store] buildIndex failed:", err);
      set({ isBuilding: false });
    }
  },

  search: (query: string): FuseResult<SearchEntry>[] => {
    if (!query.trim()) {
      return [];
    }

    // Reuse cached Fuse instance (built in buildIndex). Falls back to a
    // one-shot construction if somehow called before buildIndex.
    const { fuseInstance, entries } = get();
    const fuse = fuseInstance ?? new Fuse(entries, FUSE_OPTIONS);
    return fuse.search(query.trim());
  },
}));

// ── Invalidation: rebuild index when annotations or documents change ──

import { useAnnotationStore } from "@/stores/annotation.store";
import { useDocumentStore } from "@/stores/document.store";

// Watch for annotation / document changes and invalidate the search index.
// Debounced — we only care that it's dirty, not rebuilding immediately.
// Keep old entries visible while the index is being rebuilt in the background
// (avoids a flash of "No annotations yet" on each invalidation).
let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
const invalidateSearchIndex = () => {
  if (invalidateTimer) clearTimeout(invalidateTimer);
  invalidateTimer = setTimeout(() => {
    const st = useSearchStore.getState();
    if (st.indexBuilt) {
      useSearchStore.setState({ indexBuilt: false, fuseInstance: null });
    }
  }, 1000);
};

useAnnotationStore.subscribe(() => invalidateSearchIndex());
useDocumentStore.subscribe(() => invalidateSearchIndex());
