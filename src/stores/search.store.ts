import { create } from "zustand";
import Fuse from "fuse.js";
import type { IFuseOptions, FuseResult } from "fuse.js";
import type { AnnotationItem } from "@/stores/annotation.store";
import type { DocumentItem } from "@/stores/document.store";
import type { AIAnnotationDataV1, AIAnnotationDataV2 } from "@/types/annotation";

// ── Search entry (flattened index item for Fuse) ────────────────────

export interface SearchEntry {
  id: string;
  annotation: AnnotationItem;
  documentId: string;
  documentTitle: string;
  /** Concatenated searchable text: annotation text + AI result text */
  searchText: string;
}

// ── Build AI result text for search indexing ────────────────────────

function extractSearchableTextFromAI(
  aiResult: unknown,
): string {
  if (!aiResult || typeof aiResult !== "object") return "";

  const parts: string[] = [];

  // V1 fields
  const v1 = aiResult as Partial<AIAnnotationDataV1>;
  if (v1.translation) parts.push(v1.translation);
  if (v1.lemma) parts.push(v1.lemma);
  if (v1.definitions) {
    for (const d of v1.definitions) {
      if (d.definition) parts.push(d.definition);
      if (d.gloss) parts.push(d.gloss);
    }
  }
  if (v1.collocations) {
    for (const c of v1.collocations) {
      if (c.phrase) parts.push(c.phrase);
      if (c.translation) parts.push(c.translation);
    }
  }

  // V2 fields
  const v2 = aiResult as Partial<AIAnnotationDataV2>;
  if (v2.input) {
    if (v2.input.text) parts.push(v2.input.text);
    if (v2.input.normalized) parts.push(v2.input.normalized);
  }
  if (v2.output) {
    const out = v2.output as unknown as Record<string, unknown> | undefined;
    if (out) {
      // Word output
      if (Array.isArray(out.meanings)) {
        for (const m of out.meanings as Array<{ translation?: string }>) {
          if (m.translation) parts.push(m.translation);
        }
      }
      if (Array.isArray(out.definitions)) {
        for (const d of out.definitions as Array<{ definition?: { source?: string; target?: string } }>) {
          if (d.definition?.source) parts.push(d.definition.source);
          if (d.definition?.target) parts.push(d.definition.target);
        }
      }
      if (Array.isArray(out.examples)) {
        for (const e of out.examples as Array<{ sentence?: string; translation?: string }>) {
          if (e.sentence) parts.push(e.sentence);
          if (e.translation) parts.push(e.translation);
        }
      }
      if (Array.isArray(out.collocations)) {
        for (const c of out.collocations as Array<{ phrase?: string; translation?: string }>) {
          if (c.phrase) parts.push(c.phrase);
          if (c.translation) parts.push(c.translation);
        }
      }
      if (Array.isArray(out.synonyms)) {
        parts.push(...(out.synonyms as string[]));
      }
      // Phrase / Sentence output
      if (typeof out.translation === "string") parts.push(out.translation);
    }
  }

  return parts.join(" ");
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

            const aiText = extractSearchableTextFromAI(aiResult);
            const searchText = [item.text, aiText].filter(Boolean).join(" ");

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
