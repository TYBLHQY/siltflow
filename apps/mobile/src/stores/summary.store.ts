import { create } from "zustand";

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
  ) => void;
  clearSummary: (documentId: string) => void;
  setPageTexts: (documentId: string, texts: string[]) => void;
  setSelectedPages: (documentId: string, pages: number[] | undefined) => void;
  setTargetLang: (documentId: string, lang: string) => void;
  getTargetLang: (documentId: string) => string;
}

async function persistSummary(
  documentId: string,
  text: string,
  isAiGenerated: boolean,
) {
  const { runSql } = await import("../database");
  const now = new Date().toISOString();
  await runSql(
    `INSERT OR REPLACE INTO summaries (document_id, text, is_ai_generated, created_at, updated_at)
     VALUES (?, ?, ?, COALESCE((SELECT created_at FROM summaries WHERE document_id = ?), ?), ?)`,
    [documentId, text, isAiGenerated ? 1 : 0, documentId, now, now],
  );
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
    keyVocabulary?,
    gist?,
  ) => {
    persistSummary(documentId, text, isAiGenerated);
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

  clearSummary: (documentId) => {
    (async () => {
      const { runSql } = await import("../database");
      await runSql("DELETE FROM summaries WHERE document_id = ?", [documentId]);
    })();
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

export async function loadSummariesFromDb() {
  try {
    const { executeSql } = await import("../database");
    const docs = await executeSql("SELECT * FROM documents");
    const summaries: Record<string, DocSummary> = {};
    for (const doc of docs) {
      const rows = await executeSql("SELECT * FROM summaries WHERE document_id = ?", [doc.id]);
      if (rows.length > 0) {
        const s = rows[0];
        summaries[doc.id] = {
          text: s.text,
          isAiGenerated: !!s.is_ai_generated,
          sourceLang: s.source_lang || undefined,
        };
      }
    }
    useSummaryStore.setState({ summaries });
  } catch {
    /* ignore */
  }
}
