import { create } from "zustand";
import { getDb, nowISO } from "../database";

export interface DocSummary {
  text: string;
  isAiGenerated: boolean;
  sourceLang?: string;
  keyVocabulary?: { term: string; cefr?: string }[];
  gist?: string;
}

interface SummaryState {
  summaries: Record<string, DocSummary>;
  targetLangs: Record<string, string>;
  pageTexts: Record<string, string[]>;
  selectedPages: Record<string, number[] | undefined>;

  setSummary: (
    documentId: string,
    text: string,
    isAiGenerated?: boolean,
    sourceLang?: string,
    keyVocabulary?: { term: string; cefr?: string }[],
    gist?: string,
  ) => Promise<void>;
  clearSummary: (documentId: string) => Promise<void>;
  setPageTexts: (documentId: string, texts: string[]) => void;
  setSelectedPages: (documentId: string, pages: number[] | undefined) => void;
  setTargetLang: (documentId: string, lang: string) => void;
  getTargetLang: (documentId: string) => string;
}

export const useSummaryStore = create<SummaryState>((set, get) => ({
  summaries: {},
  targetLangs: {},
  pageTexts: {},
  selectedPages: {},

  setSummary: async (documentId, text, isAiGenerated = false, sourceLang?, keyVocabulary?, gist?) => {
    const db = getDb();
    const now = nowISO();
    await db.runAsync(
      `INSERT OR REPLACE INTO summaries (document_id, text, is_ai_generated, source_lang, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      documentId, text, isAiGenerated ? 1 : 0, sourceLang ?? null, now, now,
    );
    set((s) => ({
      summaries: {
        ...s.summaries,
        [documentId]: Object.assign(
          { text, isAiGenerated },
          sourceLang ? { sourceLang } : {},
          keyVocabulary ? { keyVocabulary } : {},
          gist ? { gist } : {},
        ),
      },
    }));
  },

  clearSummary: async (documentId) => {
    const db = getDb();
    await db.runAsync("DELETE FROM summaries WHERE document_id = ?", documentId);
    set((s) => {
      const next = { ...s.summaries };
      delete next[documentId];
      return { summaries: next };
    });
  },

  setPageTexts: (documentId, texts) =>
    set((s) => ({ pageTexts: { ...s.pageTexts, [documentId]: texts } })),

  setSelectedPages: (documentId, pages) =>
    set((s) => ({ selectedPages: { ...s.selectedPages, [documentId]: pages } })),

  setTargetLang: (documentId, lang) =>
    set((s) => ({ targetLangs: { ...s.targetLangs, [documentId]: lang } })),

  getTargetLang: (documentId) => {
    const docLang = get().targetLangs[documentId];
    return docLang ?? "";
  },
}));

/** Call once at app boot to restore summaries from database. */
export async function loadSummariesFromDb() {
  try {
    const db = getDb();
    const docs = await db.getAllAsync<any>("SELECT id FROM documents");
    const summaries: Record<string, DocSummary> = {};

    for (const doc of docs) {
      const s = await db.getFirstAsync<any>(
        "SELECT text, is_ai_generated, source_lang FROM summaries WHERE document_id = ?",
        doc.id,
      );
      if (s) {
        summaries[doc.id] = {
          text: s.text,
          isAiGenerated: !!s.is_ai_generated,
          sourceLang: s.source_lang || undefined,
        };
      }
    }
    useSummaryStore.setState({ summaries });
  } catch {
    // ignore
  }
}
