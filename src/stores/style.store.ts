import { create } from "zustand";

export interface ParagraphStyle {
  /** Ordered list of font names (CSS font-family stack) for content text. */
  fontFamilies: string[];
  /** Font size in px for content text. */
  fontSize: number;
  /** Global base font size in px (applied to <html>). */
  globalFontSize: number;
  /** Whether to show the PDF scrollbar (floating overlay style). */
  pdfScrollbar: boolean;
  /** Ordered list of font names for UI (buttons, bars, lists). */
  systemFontFamilies: string[];
  /** Max height (px) for the Learn panel (study dialog). */
  learnPanelHeight: number;
}

/** Join the font families into a CSS font-family string. */
export function buildFontStack(families: string[]): string {
  return families.map((f) => (f.includes(" ") ? `"${f}"` : f)).join(", ");
}

interface StyleState {
  style: ParagraphStyle;
  setFontFamilies: (families: string[]) => void;
  addFontFamily: (family: string) => void;
  removeFontFamily: (index: number) => void;
  moveFontFamily: (from: number, to: number) => void;
  setSystemFontFamilies: (families: string[]) => void;
  addSystemFontFamily: (family: string) => void;
  removeSystemFontFamily: (index: number) => void;
  moveSystemFontFamily: (from: number, to: number) => void;
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
  systemFontFamilies: [
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica",
    "Arial",
    "sans-serif",
  ],
  learnPanelHeight: 700,
};

function persist(style: ParagraphStyle) {
  window.siltflow.vaultConfigSet({ [STORAGE_KEY]: style });
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
      const next = {
        ...s.style,
        fontFamilies: [...s.style.fontFamilies, family],
      };
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

  moveFontFamily: (from, to) =>
    set((s) => {
      const arr = [...s.style.fontFamilies];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      const next = { ...s.style, fontFamilies: arr };
      persist(next);
      return { style: next };
    }),

  setSystemFontFamilies: (systemFontFamilies) =>
    set((s) => {
      const next = { ...s.style, systemFontFamilies };
      persist(next);
      return { style: next };
    }),

  addSystemFontFamily: (family) =>
    set((s) => {
      const next = {
        ...s.style,
        systemFontFamilies: [...s.style.systemFontFamilies, family],
      };
      persist(next);
      return { style: next };
    }),

  removeSystemFontFamily: (index) =>
    set((s) => {
      const next = {
        ...s.style,
        systemFontFamilies: s.style.systemFontFamilies.filter(
          (_, i) => i !== index,
        ),
      };
      persist(next);
      return { style: next };
    }),

  moveSystemFontFamily: (from, to) =>
    set((s) => {
      const arr = [...s.style.systemFontFamilies];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      const next = { ...s.style, systemFontFamilies: arr };
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

/** Call once on app boot to restore style from vault. */
export async function loadStyleFromVault() {
  try {
    const cfg = await window.siltflow.vaultConfigGet();
    const saved = (cfg as Record<string, unknown>)[STORAGE_KEY];
    if (saved && typeof saved === "object") {
      const s = saved as Record<string, unknown>;
      useStyleStore.setState({
        style: {
          fontFamilies:
            (s.fontFamilies as string[]) ?? DEFAULT_STYLE.fontFamilies,
          fontSize: (s.fontSize as number) ?? DEFAULT_STYLE.fontSize,
          globalFontSize:
            (s.globalFontSize as number) ?? DEFAULT_STYLE.globalFontSize,
          pdfScrollbar:
            (s.pdfScrollbar as boolean) ?? DEFAULT_STYLE.pdfScrollbar,
          systemFontFamilies:
            (s.systemFontFamilies as string[]) ??
            DEFAULT_STYLE.systemFontFamilies,
          learnPanelHeight:
            (s.learnPanelHeight as number) ?? DEFAULT_STYLE.learnPanelHeight,
        },
      });
    }
  } catch {
    /* ignore */
  }
}
