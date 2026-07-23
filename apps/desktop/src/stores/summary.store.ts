import { create } from "zustand";
import type { DocSummary } from "@/types/summary";
export type { DocSummary } from "@/types/summary";

interface SummaryState {
  /** Per-document summaries, keyed by documentId. */
  summaries: Record<string, DocSummary>;

  /**
   * Per-document target language (BCP 47) for AI translation.
   */
  targetLangs: Record<string, string>;

  /**
   * Cached per-page text for each document, keyed by documentId.
   * Indexed 0-based — page N is at index N-1.
   */
  pageTexts: Record<string, string[]>;

  /**
   * User-selected page numbers (1-based) for each document.
   * undefined = all pages (show toggle as "all").
   */
  selectedPages: Record<string, number[] | undefined>;

  setSummary: (
    documentId: string,
    text: string,
    isAiGenerated?: boolean,
    sourceLang?: string,
  ) => void;
  clearSummary: (documentId: string) => void;
  setPageTexts: (documentId: string, texts: string[]) => void;
  setSelectedPages: (documentId: string, pages: number[] | undefined) => void;
  setTargetLang: (documentId: string, lang: string) => void;
  getTargetLang: (documentId: string) => string;
}

function persistSummary(
  documentId: string,
  text: string,
  isAiGenerated: boolean,
  sourceLang?: string,
) {
  window.siltflow.summaries.save({
    documentId,
    text,
    isAiGenerated,
    sourceLang,
  }).catch(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err: any) => {
    console.error("[summary.store] save failed:", err);
  });
}

export const useSummaryStore = create<SummaryState>((set, get) => ({
  summaries: {},
  targetLangs: {},
  pageTexts: {},
  selectedPages: {},

  setSummary: (
    documentId,
    text,
    isAiGenerated = false,
    sourceLang?,
  ) => {
    persistSummary(documentId, text, isAiGenerated, sourceLang);
    set((s) => ({
      summaries: {
        ...s.summaries,
        [documentId]: Object.assign(
          { text, isAiGenerated },
          sourceLang ? { sourceLang } : {},
        ),
      },
    }));
  },

  clearSummary: (documentId) => {
    window.siltflow.summaries.delete(documentId).catch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err: any) => {
      console.error("[summary.store] delete failed:", err);
    });
    set((s) => {
      const next = { ...s.summaries };
      delete next[documentId];
      return { summaries: next };
    });
  },

  setPageTexts: (documentId, texts) =>
    set((s) => ({
      pageTexts: { ...s.pageTexts, [documentId]: texts },
    })),

  setSelectedPages: (documentId, pages) =>
    set((s) => ({
      selectedPages: { ...s.selectedPages, [documentId]: pages },
    })),

  setTargetLang: (documentId, lang) =>
    set((s) => ({
      targetLangs: { ...s.targetLangs, [documentId]: lang },
    })),

  getTargetLang: (documentId) => {
    const docLang = get().targetLangs[documentId];
    if (docLang) return docLang;
    return "";
  },
}));

/** Call once on app boot to restore summaries from backend. */
export async function loadSummariesFromVault() {
  try {
    const all = await window.siltflow.summaries.listAll();
    const summaries: Record<string, DocSummary> = {};
    for (const s of all || []) {
      summaries[s.documentId] = {
        text: s.text,
        isAiGenerated: !!s.isAiGenerated,
        sourceLang: s.sourceLang || undefined,
      };
    }
    useSummaryStore.setState({ summaries });
  } catch {
    /* ignore */
  }
}
