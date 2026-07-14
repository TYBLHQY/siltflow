import { create } from "zustand";
import { configGetAll, configSet } from "../config";

export interface ParagraphStyle {
  fontFamilies: string[];
  fontSize: number;
  globalFontSize: number;
  pdfScrollbar: boolean;
  systemFontFamilies: string[];
  learnPanelHeight: number;
}

export function buildFontStack(families: string[]): string {
  return families.map((f) => (f.includes(" ") ? `"${f}"` : f)).join(", ");
}

interface StyleState {
  style: ParagraphStyle;
  setFontFamilies: (families: string[]) => void;
  addFontFamily: (family: string) => void;
  removeFontFamily: (index: number) => void;
  setFontSize: (size: number) => void;
  setGlobalFontSize: (size: number) => void;
  setPdfScrollbar: (show: boolean) => void;
  setLearnPanelHeight: (height: number) => void;
  reset: () => void;
}

const STORAGE_KEY = "paragraphStyle";
const DEFAULT_STYLE: ParagraphStyle = {
  fontFamilies: ["Inter", "system-ui", "sans-serif"],
  fontSize: 13,
  globalFontSize: 14,
  pdfScrollbar: false,
  systemFontFamilies: ["system-ui", "sans-serif"],
  learnPanelHeight: 700,
};

function persist(style: ParagraphStyle) {
  configSet({ [STORAGE_KEY]: style });
}

export const useStyleStore = create<StyleState>((set) => ({
  style: { ...DEFAULT_STYLE },

  setFontFamilies: (fontFamilies) =>
    set((s) => {
      const next = { ...s.style, fontFamilies };
      persist(next);
      return { style: next };
    }),

  addFontFamily: (family) =>
    set((s) => {
      const next = { ...s.style, fontFamilies: [...s.style.fontFamilies, family] };
      persist(next);
      return { style: next };
    }),

  removeFontFamily: (index) =>
    set((s) => {
      const next = {
        ...s.style,
        fontFamilies: s.style.fontFamilies.filter((_, i) => i !== index),
      };
      persist(next);
      return { style: next };
    }),

  setFontSize: (fontSize) =>
    set((s) => {
      const next = { ...s.style, fontSize };
      persist(next);
      return { style: next };
    }),

  setGlobalFontSize: (globalFontSize) =>
    set((s) => {
      const next = { ...s.style, globalFontSize };
      persist(next);
      return { style: next };
    }),

  setPdfScrollbar: (pdfScrollbar) =>
    set((s) => {
      const next = { ...s.style, pdfScrollbar };
      persist(next);
      return { style: next };
    }),

  setLearnPanelHeight: (learnPanelHeight) =>
    set((s) => {
      const next = { ...s.style, learnPanelHeight };
      persist(next);
      return { style: next };
    }),

  reset: () => {
    persist(DEFAULT_STYLE);
    set({ style: { ...DEFAULT_STYLE } });
  },
}));

export async function loadStyleFromConfig() {
  try {
    const cfg = await configGetAll();
    const saved = cfg[STORAGE_KEY] as Record<string, unknown> | undefined;
    if (saved && typeof saved === "object") {
      useStyleStore.setState({
        style: { ...DEFAULT_STYLE, ...saved } as ParagraphStyle,
      });
    }
  } catch {
    // ignore
  }
}
