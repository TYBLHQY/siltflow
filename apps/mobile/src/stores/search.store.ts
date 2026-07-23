/**
 * Search store — mirrors desktop `stores/search.store.ts`.
 *
 * Builds a Fuse.js index from all documents + annotations for fuzzy
 * full-text search across the entire library.
 *
 * We install `fuse.js` as a mobile dependency (pure JS, no native).
 */

import { create } from "zustand";
import Fuse from "fuse.js";
import { getDrizzle } from "@/stores/db.store";
import { getSQLite } from "@/stores/db.store";
import { listDocuments } from "@/services/documents.service";
import { listAllAnnotations } from "@/services/annotations.service";

interface SearchEntry {
  id: string;
  type: "document" | "annotation";
  title: string;
  text: string;
  documentId?: string;
}

interface SearchState {
  fuse: Fuse<SearchEntry> | null;
  entries: SearchEntry[];
  results: { item: SearchEntry; score: number }[];
  query: string;
  isOpen: boolean;

  buildIndex: () => void;
  search: (query: string) => void;
  setOpen: (open: boolean) => void;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  fuse: null,
  entries: [],
  results: [],
  query: "",
  isOpen: false,

  buildIndex: () => {
    try {
      const drizzle = getDrizzle();
      const sqlite = getSQLite();

      const docs = listDocuments(drizzle);
      const annotations = listAllAnnotations(sqlite);

      const entries: SearchEntry[] = [
        ...docs.map((d) => ({
          id: d.id,
          type: "document" as const,
          title: d.title,
          text: d.title,
        })),
        ...annotations.map((a) => ({
          id: a.id,
          type: "annotation" as const,
          title: (a.text ?? "").slice(0, 80),
          text: (a.text ?? "") + " " + JSON.stringify(a.ai_data ?? ""),
          documentId: a.document_id,
        })),
      ];

      const fuse = new Fuse(entries, {
        keys: ["title", "text"],
        threshold: 0.4,
        ignoreLocation: true,
        ignoreDiacritics: true,
      });

      set({ fuse, entries });
    } catch (err) {
      console.error("[search.store] buildIndex failed:", err);
    }
  },

  search: (query) => {
    const { fuse } = get();
    if (!fuse || !query.trim()) {
      set({ results: [], query });
      return;
    }
    const raw = fuse.search(query.trim());
    const results = raw.slice(0, 50).map((r) => ({
      item: r.item,
      score: r.score ?? 0,
    }));
    set({ results, query });
  },

  setOpen: (isOpen) => set({ isOpen }),

  clearSearch: () => set({ results: [], query: "" }),
}));
