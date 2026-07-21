import { create } from "zustand";
import Fuse from "fuse.js";
import type { IFuseOptions, FuseResult } from "fuse.js";
import type { AnnotationItem } from "@/stores/annotation.store";
import type { DocumentItem } from "@/stores/document.store";

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
  includeScore: true,
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
  search: (query: string) => void;
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

  // ── Search ──
  query: "",
  setQuery: (q: string) => {
    set({ query: q, selectedIndex: 0 });
    get().search(q);
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
      // Load all documents
      const docs = await window.siltflow.documents.list();
      const docMap = new Map<string, DocumentItem>();
      for (const d of docs) {
        docMap.set(d.id, { id: d.id, title: d.title });
      }

      // Load annotations per-document (enriched with AI results)
      const entries: SearchEntry[] = [];
      for (const doc of docs) {
        try {
          const annotations = await window.siltflow.annotations.list(doc.id);
          for (const ann of annotations) {
            // IPC handler (electron/ipc/annotations.ipc.ts) already calls
            // tryParseJson on embed_data, ai_data, and fsrs_data. Depending on
            // the IPC serializer they may arrive as objects or strings — handle both.
            let embedData: AnnotationItem["embedData"];
            if (typeof ann.embed_data === "string") {
              try { embedData = JSON.parse(ann.embed_data); } catch { /* below */ }
            }
            if (!embedData!) {
              embedData = {
                position: { boundingRect: { x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0, pageNumber: ann.page_number ?? 1 }, rects: [] },
                content: { text: ann.text ?? "" },
              };
            }

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
              embedData: embedData!,
              aiResult,
              aiVersion: ann.ai_version ?? undefined,
              fsrsCard,
            };

            const searchText = item.text;

            entries.push({
              id: ann.id,
              annotation: item,
              documentId: ann.document_id,
              documentTitle: doc.title,
              searchText,
            });
          }
        } catch {
          // Skip documents that fail to load annotations
        }
      }

      set({ entries, indexBuilt: true, isBuilding: false });
    } catch (err) {
      console.error("[search.store] buildIndex failed:", err);
      set({ isBuilding: false });
    }
  },

  search: (query: string) => {
    const { entries } = get();
    if (!query.trim()) {
      set({ results: [], selectedIndex: 0 });
      return;
    }

    const fuse = new Fuse(entries, FUSE_OPTIONS);
    const results = fuse.search(query.trim());
    set({ results, selectedIndex: 0 });
  },
}));

// ── Invalidation: rebuild index when annotations change ────────────

import { useAnnotationStore } from "@/stores/annotation.store";

// Watch for annotation changes and invalidate the search index.
// Debounced — we only care that it's dirty, not rebuilding immediately.
let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
useAnnotationStore.subscribe(() => {
  if (invalidateTimer) clearTimeout(invalidateTimer);
  invalidateTimer = setTimeout(() => {
    const st = useSearchStore.getState();
    if (st.indexBuilt) {
      useSearchStore.setState({ indexBuilt: false, entries: [] });
    }
  }, 1000);
});
