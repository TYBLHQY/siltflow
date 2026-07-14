import { create } from "zustand";
import { configGetAll, configSet } from "../config";

export type ThemeFlavor = "latte" | "frappe" | "macchiato" | "mocha";
export type ThemeMode = "auto" | "light" | "dark";

export interface ThemeConfig {
  lightTheme: ThemeFlavor;
  darkTheme: ThemeFlavor;
  themeMode: ThemeMode;
  pdfDarkInvert: boolean;
}

interface ThemeStoreState {
  config: ThemeConfig;
  setLightTheme: (flavor: ThemeFlavor) => void;
  setDarkTheme: (flavor: ThemeFlavor) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setPdfDarkInvert: (v: boolean) => void;
  resolveTheme: () => { flavor: ThemeFlavor; isDark: boolean };
}

const STORAGE_KEY = "themeConfig";

const DEFAULT_CONFIG: ThemeConfig = {
  lightTheme: "latte",
  darkTheme: "mocha",
  themeMode: "auto",
  pdfDarkInvert: true,
};

function persist(config: ThemeConfig) {
  configSet({ [STORAGE_KEY]: config });
}

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  config: { ...DEFAULT_CONFIG },

  setLightTheme: (lightTheme) =>
    set((s) => {
      const next = { ...s.config, lightTheme };
      persist(next);
      return { config: next };
    }),

  setDarkTheme: (darkTheme) =>
    set((s) => {
      const next = { ...s.config, darkTheme };
      persist(next);
      return { config: next };
    }),

  setThemeMode: (themeMode) =>
    set((s) => {
      const next = { ...s.config, themeMode };
      persist(next);
      return { config: next };
    }),

  setPdfDarkInvert: (pdfDarkInvert) =>
    set((s) => {
      const next = { ...s.config, pdfDarkInvert };
      persist(next);
      return { config: next };
    }),

  resolveTheme: () => {
    const { lightTheme, darkTheme, themeMode } = get().config;
    if (themeMode === "light") return { flavor: lightTheme, isDark: false };
    if (themeMode === "dark") return { flavor: darkTheme, isDark: true };
    // auto — on mobile we can't match OS media query easily; default to light
    return { flavor: lightTheme, isDark: false };
  },
}));

export async function loadThemeFromConfig() {
  try {
    const cfg = await configGetAll();
    const saved = cfg[STORAGE_KEY] as Partial<ThemeConfig> | undefined;
    if (saved && typeof saved === "object") {
      useThemeStore.setState({ config: { ...DEFAULT_CONFIG, ...saved } });
    }
  } catch {
    // ignore
  }
}
